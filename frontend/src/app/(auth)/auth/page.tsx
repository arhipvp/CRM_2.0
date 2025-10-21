import { redirect } from "next/navigation";

type SearchParams = {
  redirect?: string;
};

export default function AuthPage({ searchParams }: { searchParams: SearchParams }) {
  const target = searchParams?.redirect;
  const suffix = target && target.startsWith("/") ? `?redirect=${encodeURIComponent(target)}` : "";

  redirect(`/login${suffix}`);
}
