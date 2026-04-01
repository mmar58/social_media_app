import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validateBody } from "../validation";
import { loginSchema, registerSchema } from "../validation/schemas";

const router = Router();

router.post("/register", validateBody(registerSchema), async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    
    // Check if user exists
    const existing = await db("users").where({ email }).first();
    if (existing) return res.status(400).json({ message: "Email already taken" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const profile_picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(first_name + ' ' + last_name)}&background=random`;
    
    const [id] = await db("users").insert({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      profile_picture
    });
    
    const token = jwt.sign({ id, email, first_name, last_name, profile_picture }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });

    // Set secure httpOnly cookie for environments that support it
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ token, user: { id, first_name, last_name, email, profile_picture } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db("users").where({ email }).first();
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    
    const token = jwt.sign(
      { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, profile_picture: user.profile_picture }, 
      process.env.JWT_SECRET || "secret", 
      { expiresIn: "7d" }
    );
    // set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ token, user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, profile_picture: user.profile_picture } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// optional logout to clear httpOnly cookie
router.post("/logout", (req, res) => {
  res.cookie("token", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
  res.json({ success: true });
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    const user = await db("users").where({ id: userId }).first();
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = jwt.sign(
      { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, profile_picture: user.profile_picture },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    // refresh cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, profile_picture: user.profile_picture };
    res.json({ token, user: safeUser });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
