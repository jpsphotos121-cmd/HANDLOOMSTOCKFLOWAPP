import {
  createActorWithConfig,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { createActor } from "../backend";
import type { backendInterface } from "../backend";

/**
 * Gets a secret parameter from the URL hash fragment or session storage.
 * Hash fragments are not sent to servers or logged — safe for admin tokens.
 */
export function getSecretParameter(paramName: string): string | null {
  try {
    // Check session storage first for persistence across navigation
    const stored = sessionStorage.getItem(paramName);
    if (stored) return stored;
    // Try hash fragment (format: #paramName=value or #/route?paramName=value)
    const hash = window.location.hash;
    if (hash) {
      const hashContent = hash.startsWith("#") ? hash.substring(1) : hash;
      const qIdx = hashContent.indexOf("?");
      const queryPart =
        qIdx >= 0 ? hashContent.substring(qIdx + 1) : hashContent;
      const params = new URLSearchParams(queryPart);
      const val = params.get(paramName);
      if (val) {
        sessionStorage.setItem(paramName, val);
        return val;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const ACTOR_QUERY_KEY = "actor";

export function useActor() {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  const actorQuery = useQuery<backendInterface>({
    queryKey: [ACTOR_QUERY_KEY, identity?.getPrincipal().toString()],
    queryFn: async () => {
      const actorOptions = identity
        ? { agentOptions: { identity } }
        : undefined;
      // createActorWithConfig loads canister ID from env.json, creates an HttpAgent,
      // then calls createActor(canisterId, uploadFile, downloadFile, options)
      const actor = (await createActorWithConfig(
        createActor,
        actorOptions,
      )) as backendInterface;
      // Initialize access control — wrapped in try/catch so a missing env var
      // or expired token doesn't kill the whole actor.
      try {
        const adminToken = getSecretParameter("caffeineAdminToken") || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (actor as any)._initializeAccessControlWithSecret(adminToken);
      } catch (e) {
        console.warn("Access control initialization failed (non-fatal):", e);
      }
      return actor;
    },
    // Only refetch when identity changes
    staleTime: Number.POSITIVE_INFINITY,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    enabled: true,
  });

  // When the actor changes, invalidate all dependent queries
  useEffect(() => {
    if (actorQuery.data) {
      queryClient.invalidateQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
      queryClient.refetchQueries({
        predicate: (query) => !query.queryKey.includes(ACTOR_QUERY_KEY),
      });
    }
  }, [actorQuery.data, queryClient]);

  return {
    actor: actorQuery.data || null,
    isFetching: actorQuery.isFetching,
    isError: actorQuery.isError,
  };
}
