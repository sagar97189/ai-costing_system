import React from 'react';

const COLUMNS = [
  {
    title: 'ABOUT',
    links: ['About Us', 'Support']
  },
  {
    title: 'COMPANY',
    links: ['Engineering Drawing AI', 'Resume Parser']
  },
  {
    title: 'CONTACT',
    links: ['hello@amanzi.ai', '+91 XXXXX XXXXX']
  }
];

export function FooterLinks() {
  return (
    <div className="flex flex-col md:flex-row gap-16 md:gap-24 w-full md:w-auto mt-16 md:mt-0 z-20 relative">
      {COLUMNS.map((col, idx) => (
        <div key={idx} className="flex flex-col gap-6 footer-column">
          <h4 className="font-mono text-xs uppercase tracking-widest text-white/30">{col.title}</h4>
          <ul className="flex flex-col gap-4">
            {col.links.map((link, i) => (
              <li key={i}>
                <a 
                  href="#" 
                  className="font-mono text-sm text-white/60 hover:text-white transition-colors relative group inline-block py-0.5"
                >
                  {link}
                  <span className="absolute left-0 -bottom-0.5 w-0 h-[1px] bg-gradient-to-r from-[#FF5E3A] to-[#FF9B6A] transition-all duration-300 ease-out group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
