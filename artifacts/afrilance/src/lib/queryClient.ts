import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: () => {
      toast({
        title: "Couldn't load information",
        description: "Please try again. If the problem continues, contact support.",
        variant: "destructive",
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: () => {
      toast({
        title: "That action didn't complete",
        description: "Please try again. If the problem continues, contact support.",
        variant: "destructive",
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
