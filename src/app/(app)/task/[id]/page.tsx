import { Suspense } from "react";
import { TaskPage } from "@/components/TaskPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <TaskPage id={id} />
    </Suspense>
  );
}
