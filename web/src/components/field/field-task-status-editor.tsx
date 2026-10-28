"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TodayTaskEditor } from "@/components/dashboard/today-task-editor";
import type { TodayTaskTarget } from "@/lib/today-model";

export function FieldTaskStatusEditor({ task }: { task: TodayTaskTarget }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return saved ? <p role="status" className="text-sm text-success">Task saved. Refreshing job details…</p> : <TodayTaskEditor task={task} online={online} onBusy={() => {}} onSaved={() => { setSaved(true); router.refresh(); }} />;
}
