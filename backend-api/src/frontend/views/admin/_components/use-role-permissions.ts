"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAccess } from "@/frontend/controllers/admin-data-cache";
import type {
  RoleAccessAction,
  RoleAccessMenuKey,
} from "@/lib/role-access";

const accessCacheKey = "pos_admin_role_permissions";

function emptyPermissions() {
  return {} as Record<RoleAccessMenuKey, RoleAccessAction[]>;
}

export function useRolePermissions(menu: RoleAccessMenuKey) {
  const [permissions, setPermissions] =
    useState<Record<RoleAccessMenuKey, RoleAccessAction[]>>(emptyPermissions);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentAccess() {
      try {
        const data = await getCurrentAccess();
        if (!cancelled) {
          setPermissions(data.permissions);
          window.sessionStorage.setItem(
            accessCacheKey,
            JSON.stringify(data.permissions),
          );
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPermissions(emptyPermissions());
          setIsLoading(false);
        }
      }
    }

    void loadCurrentAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const menuPermissions = permissions[menu] ?? [];
    const can = (action: RoleAccessAction) => menuPermissions.includes(action);
    return {
      can,
      canView: can("view"),
      canCreate: can("create"),
      canEdit: can("edit"),
      canDelete: can("delete"),
      canApprove: can("approve"),
      canExport: can("export"),
      isLoading,
    };
  }, [isLoading, menu, permissions]);
}
