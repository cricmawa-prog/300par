'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useUser } from '../lib/auth/AuthProvider';
import UserMenu from './Auth/UserMenu';
import Link from 'next/link';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Close the mobile menu whenever the page changes.
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);
    const { isSignedIn, member, isAdmin } = useUser();
    // Private beta: the game links only make sense once the account is approved.
    const links = [
        { href: '/', label: 'Home' },
        ...(member
            ? [
                  { href: '/300par', label: '300 Par' },
                  { href: '/300par/duel', label: '1v1 Duel' },
                  { href: '/tournaments', label: 'Tournaments' },
                  { href: '/dashboard', label: 'Dashboard' },
              ]
            : []),
        ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
    ];

    return (
        <nav className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur px-4 py-3">
            <div className="flex justify-between items-center">
                <Link href="/" className="font-display text-lg tracking-wide text-accent hidden md:block">
                    300 PAR
                </Link>

                <div className="md:hidden">
                    <button onClick={() => setIsOpen(!isOpen)} className="text-text">
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <ul className={`md:flex text-text gap-2 text-base font-medium list-none ${isOpen ? 'block' : 'hidden'} absolute top-14 left-0 w-full bg-bg border-b border-border md:border-none md:static md:w-auto md:flex md:items-center md:gap-2`}>
                    {links.map((l) => (
                        <li key={l.href} className={`hover:text-accent hover:bg-surface transition-colors rounded-lg p-2 px-3 ${pathname === l.href ? 'text-accent' : ''}`}>
                            <Link href={l.href}>{l.label}</Link>
                        </li>
                    ))}
                </ul>

                <div className='md:block'>
                    {isSignedIn ? (
                        <UserMenu />
                    ) : (
                        <div className='flex gap-5'>
                            <Link href="/signin">
                                <button className="py-2 px-4 rounded-lg text-white cursor-pointer bg-accent hover:bg-accentHover transition-colors font-semibold">Sign in</button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
