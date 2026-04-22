import { redirect } from "next/navigation";

export default async function IdeasRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/clients/${id}/scripts`);
}
