"use client";
import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/masterplan', label: 'Masterplan' },
    { href: '/persone', label: 'Persone' },
    { href: '/assenze', label: 'Assenze' },
    { href: '/progetti', label: 'Progetti' },
    { href: '/copertura/dev', label: 'Copertura Dev' },
    { href: '/copertura/bugfix', label: 'Copertura Bugfix' },
    { href: '/copertura/team-leading', label: 'Team Leading' },
  ];

  return (
    <header className="bg-white/60 backdrop-blur-md sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">UI</div>
            <div className="hidden sm:block">
              <div className="text-lg font-semibold text-slate-700">UI Management</div>
              <div className="text-xs text-slate-500">Team & Progetti</div>
            </div>
          </Link>
        </div>

        <div className="flex-1">
          <nav className="hidden md:flex justify-center">
            <ul className="flex space-x-6 text-sm font-medium text-slate-600">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="px-2 py-1 rounded hover:bg-slate-100 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* mobile menu */}
          <div className="md:hidden flex justify-center">
            <button
              aria-label="Apri menu"
              onClick={() => setOpen((s) => !s)}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border rounded-full px-3 py-1 shadow-sm hover:shadow-md transition">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center">LD</div>
            <div className="hidden sm:block text-sm text-slate-600">Luigi</div>
          </button>
        </div>
      </div>

      {/* mobile links panel */}
      {open && (
        <div className="md:hidden bg-white border-t">
          <div className="container mx-auto px-4 py-3">
            <ul className="flex flex-col space-y-2 text-slate-700">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block px-3 py-2 rounded hover:bg-slate-50 transition">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}