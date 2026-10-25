import { useState } from "react";
import { Text } from "react-native";
import type { DocumentPickerAsset } from "expo-document-picker";
import { resumesApi, jobTitlesApi } from "@/services/api";
import { pickResume, shareResume, uploadResume } from "@/services/files";
import { useAction, useResource } from "@/hooks/use-resource";
import {
  Button,
  Card,
  Empty,
  Feedback,
  Field,
  Page,
  Toggle,
  confirm,
  styles,
} from "@/components/ui";
import type { JobTitle, Resume } from "@/types";

function Mappings({
  titles,
  ids,
  setIds,
  disabled,
}: {
  titles: JobTitle[];
  ids: number[];
  setIds: (ids: number[]) => void;
  disabled: boolean;
}) {
  return (
    <>
      {titles.map((title) => (
        <Toggle
          key={title.id}
          label={title.title}
          value={ids.includes(title.id)}
          disabled={disabled}
          onChange={(value) =>
            setIds(
              value ? [...ids, title.id] : ids.filter((id) => id !== title.id),
            )
          }
        />
      ))}
    </>
  );
}
function ResumeEditor({
  resume,
  titles,
  refresh,
}: {
  resume: Resume;
  titles: JobTitle[];
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(resume.title);
  const [active, setActive] = useState(resume.active);
  const [ids, setIds] = useState(resume.mapped_job_titles.map((t) => t.id));
  const [expanded, setExpanded] = useState(false);
  const action = useAction();
  return (
    <Card>
      <Text style={styles.h2}>{resume.title}</Text>
      <Text style={styles.muted}>{resume.file_name}</Text>
      <Field
        label="Resume title"
        value={title}
        onChangeText={setTitle}
        editable={!action.busy}
      />
      <Toggle
        label="Active"
        value={active}
        onChange={setActive}
        disabled={action.busy}
      />
      <Mappings
        titles={titles}
        ids={ids}
        setIds={setIds}
        disabled={action.busy}
      />
      <Feedback {...action} />
      <Button
        label="Save resume"
        secondary
        disabled={action.busy || !title.trim()}
        onPress={() => {
          void action.run(async () => {
            await resumesApi.update(resume.id, {
              title: title.trim(),
              active,
              job_title_ids: ids,
            });
            await refresh();
          }, "Resume saved.");
        }}
      />
      <Button
        label="Download / share"
        secondary
        disabled={action.busy}
        onPress={() => {
          void action.run(() => shareResume(resume));
        }}
      />
      <Button
        label={expanded ? "Hide extracted text" : "View extracted text"}
        secondary
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <Text selectable style={styles.muted}>
          {resume.extracted_text || "No extracted text available."}
        </Text>
      )}
      <Button
        danger
        label="Delete resume"
        disabled={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (await confirm("Delete resume?", resume.title)) {
              await resumesApi.delete(resume.id);
              await refresh();
            }
          });
        }}
      />
    </Card>
  );
}
export function Resumes() {
  const resource = useResource(async () => {
    const [resumes, titles] = await Promise.all([
      resumesApi.list(),
      jobTitlesApi.list(),
    ]);
    return { resumes, titles };
  });
  const action = useAction();
  const [asset, setAsset] = useState<DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState("");
  const [ids, setIds] = useState<number[]>([]);
  return (
    <Page
      title="My resumes"
      subtitle="Bring your best experience to each role."
      back
      {...resource}
    >
      <Card title="Upload a resume">
        <Field
          label="Resume title"
          value={title}
          onChangeText={setTitle}
          editable={!action.busy}
        />
        <Button
          secondary
          label={asset ? asset.name : "Choose PDF or DOCX"}
          disabled={action.busy}
          onPress={() => {
            void action.run(async () => {
              const picked = await pickResume();
              if (picked) {
                setAsset(picked);
                if (!title) setTitle(picked.name.replace(/\.[^.]+$/, ""));
              }
            });
          }}
        />
        <Text style={styles.muted}>Link this resume to your target roles:</Text>
        <Mappings
          titles={resource.data?.titles || []}
          ids={ids}
          setIds={setIds}
          disabled={action.busy}
        />
        <Feedback {...action} />
        <Button
          label="Upload resume"
          disabled={action.busy || !asset || !title.trim()}
          onPress={() => {
            void action.run(async () => {
              if (!asset) return;
              await uploadResume(asset, title, ids);
              setAsset(null);
              setTitle("");
              setIds([]);
              await resource.refresh();
            }, "Resume uploaded.");
          }}
        />
      </Card>
      {resource.data?.resumes.map((resume) => (
        <ResumeEditor
          key={`${resume.id}-${resume.updated_at}`}
          resume={resume}
          titles={resource.data?.titles || []}
          refresh={resource.refresh}
        />
      ))}
      {resource.data && !resource.data.resumes.length && (
        <Empty text="Upload your first resume to get started." />
      )}
    </Page>
  );
}
