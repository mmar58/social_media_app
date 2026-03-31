import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    
    // Check if user exists
    const existing = await db("users").where({ email }).first();
    if (existing) return res.status(400).json({ message: "Email already taken" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const [id] = await db("users").insert({
      first_name,
      last_name,
      email,
      password: hashedPassword,
    });
    
    const token = jwt.sign({ id, email, first_name, last_name }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
    res.json({ token, user: { id, first_name, last_name, email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db("users").where({ email }).first();
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    
    const token = jwt.sign(
      { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name }, 
      process.env.JWT_SECRET || "secret", 
      { expiresIn: "7d" }
    );
    
    res.json({ token, user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", authenticate, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

export default router;
