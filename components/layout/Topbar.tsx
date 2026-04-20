'use client';

import { useState } from 'react';
import { Search, Bell, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopbarProps {
  title?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export default function Topbar({
  title,
  showSearch = true,
  searchPlaceholder = 'Search...',
  onSearch,
}: TopbarProps) {
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch?.(value);
  };

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full h-16",
      "bg-background/80 backdrop-blur-xl",
      "flex items-center justify-between px-8 py-4",
      "border-b border-outline-variant/15",
      "transition-all duration-200 ease-in-out"
    )}>
      {/* Left: Title + Search */}
      <div className="flex items-center gap-6 flex-1">
        {title && (
          <h2 className="text-lg font-bold text-on-surface font-headline">
            {title}
          </h2>
        )}
        {showSearch && (
          <div className="relative hidden md:block max-w-md flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                "w-full pl-12 pr-4 py-2.5 rounded-xl",
                "bg-surface-container-lowest border-none",
                "font-body text-sm text-on-surface placeholder:text-outline",
                "focus:outline-none focus:bg-surface-bright",
                "focus:shadow-[0px_20px_40px_rgba(13,12,34,0.06)]",
                "transition-all duration-300 ambient-shadow"
              )}
            />
          </div>
        )}
      </div>

      {/* Right: Actions + Avatar */}
      <div className="flex items-center gap-2">
        <button className={cn(
          "p-2 rounded-full text-outline hover:bg-surface-container-low",
          "hover:text-on-surface transition-colors duration-200",
          "flex items-center justify-center cursor-pointer border-none bg-transparent"
        )}>
          <Bell className="w-[20px] h-[20px]" />
        </button>
        <button className={cn(
          "p-2 rounded-full text-outline hover:bg-surface-container-low",
          "hover:text-on-surface transition-colors duration-200",
          "flex items-center justify-center cursor-pointer border-none bg-transparent"
        )}>
          <History className="w-[20px] h-[20px]" />
        </button>
        <button className={cn(
          "p-2 rounded-full text-outline hover:bg-surface-container-low",
          "hover:text-on-surface transition-colors duration-200",
          "flex items-center justify-center cursor-pointer border-none bg-transparent"
        )}>
          <User className="w-[20px] h-[20px]" />
        </button>
      </div>
    </header>
  );
}
