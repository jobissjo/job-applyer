import { useState } from "react";
import { Text } from "react-native";
import { learningApi } from "@/services/api";
import { useAction, useResource } from "@/hooks/use-resource";
import {
  Badge,
  Button,
  Card,
  Choice,
  Empty,
  Feedback,
  Field,
  Nav,
  Page,
  confirm,
  openLink,
  styles,
} from "@/components/ui";
import type {
  LearningEntry,
  LearningItem,
  LearningStatus,
  SkillGap,
} from "@/types";

export function SkillGaps({
  jobId,
  resumeId,
}: {
  jobId: number;
  resumeId: number;
}) {
  const [skills, setSkills] = useState<SkillGap[]>([]);
  const [skill, setSkill] = useState("");
  const action = useAction();
  return (
    <Card title="Build your skills">
      <Text style={styles.muted}>
        Compare your selected resume with this opportunity, or add a skill
        manually.
      </Text>
      <Feedback {...action} />
      <Button
        secondary
        label="Find skill gaps"
        disabled={action.busy || !resumeId}
        onPress={() => {
          void action.run(async () => {
            setSkills(await learningApi.gaps(jobId, resumeId));
          });
        }}
      />
      {skills.map((item) => (
        <Card key={item.skill}>
          <Text style={styles.h2}>{item.skill}</Text>
          <Text style={styles.muted}>{item.reason}</Text>
          <Button
            secondary
            label="Add / link to learning"
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                await learningApi.create(item.skill, [jobId]);
              }, "Skill linked to this opportunity.");
            }}
          />
        </Card>
      ))}
      <Field label="Skill to learn" value={skill} onChangeText={setSkill} />
      <Button
        secondary
        label="Add / link skill"
        disabled={action.busy || !skill.trim()}
        onPress={() => {
          void action.run(async () => {
            await learningApi.create(skill.trim(), [jobId]);
            setSkill("");
          }, "Skill saved.");
        }}
      />
      <Nav label="Open learning tracker" href="/learning" />
    </Card>
  );
}
function EntryEditor({
  entry,
  itemId,
  refresh,
}: {
  entry?: LearningEntry;
  itemId: number;
  refresh: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"note" | "resource">(entry?.kind || "note");
  const [content, setContent] = useState(entry?.content || "");
  const [url, setUrl] = useState(entry?.url || "");
  const action = useAction();
  return (
    <Card>
      <Choice
        label={entry ? "Entry type" : "Add a note or resource"}
        value={kind}
        options={[
          { value: "note", label: "Note" },
          { value: "resource", label: "Resource" },
        ]}
        onChange={setKind}
        disabled={action.busy}
      />
      <Field
        label="Content"
        multiline
        value={content}
        onChangeText={setContent}
        editable={!action.busy}
      />
      {kind === "resource" && (
        <Field
          label="Resource URL"
          value={url}
          onChangeText={setUrl}
          editable={!action.busy}
        />
      )}
      <Feedback {...action} />
      <Button
        secondary
        label={entry ? "Save entry" : "Add entry"}
        disabled={
          action.busy || !content.trim() || (kind === "resource" && !url.trim())
        }
        onPress={() => {
          void action.run(async () => {
            await learningApi.saveEntry(
              itemId,
              {
                kind,
                content: content.trim(),
                url: kind === "resource" ? url.trim() : null,
              },
              entry?.id,
            );
            if (!entry) {
              setContent("");
              setUrl("");
            }
            await refresh();
          });
        }}
      />
      {!!(entry?.url) && (
        <Button
          secondary
          label="Open resource ↗"
          onPress={() => {
            void action.run(() => openLink(entry.url!));
          }}
        />
      )}
      {entry && (
        <Button
          danger
          label="Delete entry"
          disabled={action.busy}
          onPress={() => {
            void action.run(async () => {
              if (
                await confirm("Delete entry?", "Remove this note or resource?")
              ) {
                await learningApi.deleteEntry(itemId, entry.id);
                await refresh();
              }
            });
          }}
        />
      )}
    </Card>
  );
}
function LearningEditor({
  item,
  refresh,
}: {
  item: LearningItem;
  refresh: () => Promise<void>;
}) {
  const action = useAction();
  const [expanded, setExpanded] = useState(false);
  return (
    <Card title={item.skill}>
      <Badge value={item.status} />
      <Choice
        label="Progress"
        value={item.status}
        options={(
          ["planned", "in_progress", "completed", "on_hold"] as LearningStatus[]
        ).map((value) => ({ value, label: value.replace("_", " ") }))}
        disabled={action.busy}
        onChange={(status) => {
          void action.run(async () => {
            await learningApi.update(item.id, status);
            await refresh();
          });
        }}
      />
      <Feedback {...action} />
      {item.jobs.map((job) => (
        <Card key={job.id}>
          <Nav
            label={`${job.title} · ${job.company}`}
            href={`/jobs/${job.id}`}
          />
          <Button
            secondary
            label="Unlink job"
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                await learningApi.unlink(item.id, job.id);
                await refresh();
              });
            }}
          />
        </Card>
      ))}
      <Button
        secondary
        label={
          expanded
            ? "Hide notes & resources"
            : `Notes & resources (${item.entries.length})`
        }
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          {item.entries.map((entry) => (
            <EntryEditor
              key={entry.id}
              entry={entry}
              itemId={item.id}
              refresh={refresh}
            />
          ))}
          <EntryEditor itemId={item.id} refresh={refresh} />
        </>
      )}
      <Button
        danger
        label="Delete skill"
        disabled={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (
              await confirm(
                "Delete skill?",
                "This removes its notes, resources, and job links.",
              )
            ) {
              await learningApi.delete(item.id);
              await refresh();
            }
          });
        }}
      />
    </Card>
  );
}
export function Learning() {
  const resource = useResource(learningApi.list);
  const action = useAction();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [skill, setSkill] = useState("");
  const items = resource.data?.filter(
    (item) =>
      (!status || item.status === status) &&
      `${item.skill} ${item.jobs.map((job) => `${job.title} ${job.company}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Page
      title="Keep learning"
      subtitle="Turn job requirements into your next skills."
      {...resource}
    >
      <Card>
        <Field label="New skill" value={skill} onChangeText={setSkill} />
        <Feedback {...action} />
        <Button
          label="Add skill"
          disabled={action.busy || !skill.trim()}
          onPress={() => {
            void action.run(async () => {
              await learningApi.create(skill.trim());
              setSkill("");
              await resource.refresh();
            });
          }}
        />
      </Card>
      <Field
        label="Search skills or linked jobs"
        value={query}
        onChangeText={setQuery}
      />
      <Choice
        label="Status"
        value={status}
        options={["", "planned", "in_progress", "completed", "on_hold"].map(
          (value) => ({
            value,
            label: value ? value.replace("_", " ") : "All",
          }),
        )}
        onChange={setStatus}
      />
      {items?.map((item) => (
        <LearningEditor key={item.id} item={item} refresh={resource.refresh} />
      ))}
      {items && !items.length && (
        <Empty text="No skills in this view. Add one above or find skill gaps on an opportunity." />
      )}
    </Page>
  );
}
