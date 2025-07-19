'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Navbar() {
  console.log('🚨 NAVBAR COMPONENT IS RENDERING!')
  
  useEffect(() => {
    console.log('🚨 NAVBAR COMPONENT MOUNTED!')
  }, [])

  return (
    <nav className="bg-red-500 text-white p-4 shadow-lg" style={{border: '3px solid yellow'}}>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div className="text-xl font-bold">
            🚴 Strava Heatmap - NAVBAR TEST
          </div>
          <div className="flex items-center space-x-4">
            <span>User Profile</span>
            <button className="bg-white text-red-500 px-4 py-2 rounded">
              Login
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
} 