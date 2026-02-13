import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { InstanceProvider } from "@/lib/instance-context";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="n8n-dashboard-theme">
      <QueryClientProvider client={queryClient}>
        <InstanceProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </InstanceProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
