"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <nav className="navbar navbar-expand-lg navbar-light _header_nav _padd_t10">
      <div className="container _custom_container">
        <div className="_logo_wrap">
          <Link className="navbar-brand" href="/feed">
            <img src="/assets/images/logo.svg" alt="Image" className="_nav_logo" />
          </Link>
        </div>
        
        {user && (
          <div className="collapse navbar-collapse d-flex justify-content-end" id="navbarSupportedContent">
            <div className="_header_nav_profile" style={{ cursor: "pointer" }} onClick={() => setDropdownOpen(!dropdownOpen)}>
              <div className="_header_nav_profile_image">
                <img src="/assets/images/profile.png" alt="Image" className="_nav_profile_img" />
              </div>
              <div className="_header_nav_dropdown">
                <p className="_header_nav_para">{user.first_name} {user.last_name}</p>
              </div>
              
              {dropdownOpen && (
                <div id="_prfoile_drop" className="_nav_profile_dropdown _profile_dropdown" style={{ display: "block", right: 0, position: "absolute", top: "100%", zIndex: 99 }}>
                  <div className="_nav_profile_dropdown_info">
                    <div className="_nav_profile_dropdown_info_txt">
                      <h4 className="_nav_dropdown_title">{user.first_name}</h4>
                    </div>
                  </div>
                  <hr />
                  <ul className="_nav_dropdown_list">
                    <li className="_nav_dropdown_list_item">
                      <a href="#0" className="_nav_dropdown_link" onClick={(e) => { e.preventDefault(); logout(); }}>
                        <div className="_nav_drop_info">Log Out</div>
                      </a>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
