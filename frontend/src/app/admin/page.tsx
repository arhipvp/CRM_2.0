import { AuditLog } from "@/components/admin/AuditLog";
import { DictionaryEditor } from "@/components/admin/DictionaryEditor";
import { UserManagement } from "@/components/admin/UserManagement";
import { getServerApiClient } from "@/lib/api/client";
import {
  adminAuditLogQueryOptions,
  adminDictionariesQueryOptions,
  adminRolesQueryOptions,
  adminUsersQueryOptions,
} from "@/lib/api/admin/queries";

export const revalidate = 0;

export default async function AdminPage() {
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();

  await Promise.all([
    queryClient.prefetchQuery(adminRolesQueryOptions(serverApiClient)),
    queryClient.prefetchQuery(adminUsersQueryOptions(undefined, serverApiClient)),
    queryClient.prefetchQuery(adminDictionariesQueryOptions(undefined, serverApiClient)),
    queryClient.prefetchQuery(adminAuditLogQueryOptions(undefined, serverApiClient)),
  ]);

  return (
    <main className="space-y-8 pb-12">
      <UserManagement />
      <DictionaryEditor />
      <AuditLog />
    </main>
  );
}
