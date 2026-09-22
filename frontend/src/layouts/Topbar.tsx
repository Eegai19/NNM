import { ChevronDown, KeyRound, LogOut, Menu, UserCircle2 } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { GlobalSearch } from "@/components/common/GlobalSearch";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/utils/constants";
import { initials } from "@/utils/format";

interface TopbarProps {
  onMenuClick: () => void;
  onChangePassword: () => void;
}

export function Topbar({ onMenuClick, onChangePassword }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = React.useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1">
        <GlobalSearch />
      </div>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Account menu">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(user?.name ?? "?")}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[140px] truncate text-sm font-medium">
                {user?.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {user ? ROLE_LABELS[user.role] : ""}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">@{user?.username}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserCircle2 />
            {user ? ROLE_LABELS[user.role] : ""} account
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onChangePassword}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={handleLogout}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
