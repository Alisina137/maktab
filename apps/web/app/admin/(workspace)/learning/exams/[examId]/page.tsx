"use client";

import { useParams } from "next/navigation";
import { LearningPanel } from "../../../../learning-panel";
import { useAdminWorkspace } from "../../../../admin-workspace";

export default function AdminExamDetailsPage() {
  const { stored } = useAdminWorkspace();
  const params = useParams<{ examId: string }>();
  return <LearningPanel key={params.examId} accessToken={stored.session.accessToken}
    initialExamId={params.examId} />;
}
