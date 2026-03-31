"use client";

import React from "react";

export default function Loader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#f6f7fb', 
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <div className="custom-loader"></div>
      <style>{`
        .custom-loader {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 4px solid rgba(24, 144, 255, 0.1);
          border-top-color: #1890FF;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
