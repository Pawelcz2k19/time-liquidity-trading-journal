import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Trades from "@/pages/trades";
import TradeForm from "@/pages/trade-form";
import Journal from "@/pages/journal";
import Playbooks from "@/pages/playbooks";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trades" component={Trades} />
      <Route path="/trades/new" component={TradeForm} />
      <Route path="/trades/:id" component={TradeForm} />
      <Route path="/journal" component={Journal} />
      <Route path="/playbooks" component={Playbooks} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppShell>
              <AppRouter />
            </AppShell>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
