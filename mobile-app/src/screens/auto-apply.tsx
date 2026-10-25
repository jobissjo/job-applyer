import { useState } from "react";
import { Text } from "react-native";
import { applicationsApi, autoApplyApi } from "@/services/api";
import { jobSources } from "@/services/jobSources";
import { useAction } from "@/hooks/use-resource";
import {
  Badge,
  Button,
  Card,
  Choice,
  Feedback,
  Field,
  Nav,
  Notice,
  Page,
  ScheduleField,
  Toggle,
  confirm,
  scheduleISO,
  styles,
} from "@/components/ui";

type Report = Awaited<ReturnType<typeof autoApplyApi.run>>;
export function AutoApply() {
  const action = useAction();
  const [source, setSource] = useState("technopark");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState("1");
  const [limit, setLimit] = useState("5");
  const [report, setReport] = useState<Report>();
  const [selected, setSelected] = useState<number[]>([]);
  const [sendAt, setSendAt] = useState("");
  const eligible =
    report?.jobs.filter(
      (job) => job.status === "ready" && job.application_id,
    ) || [];
  return (
    <Page
      title="Find your fit, faster"
      subtitle="Search, match, and prepare. You choose which applications to send."
    >
      <Card title="Discover opportunities">
        <Choice
          label="Job source"
          value={source}
          options={jobSources}
          onChange={setSource}
          disabled={action.busy}
        />
        <Field
          label="Search keyword"
          value={query}
          onChangeText={setQuery}
          editable={!action.busy}
        />
        <Field
          label="Page"
          value={page}
          keyboardType="number-pad"
          onChangeText={setPage}
          editable={!action.busy}
        />
        <Field
          label="Jobs to process (1–20)"
          value={limit}
          keyboardType="number-pad"
          onChangeText={setLimit}
          editable={!action.busy}
        />
        <Text style={styles.muted}>
          AI matches jobs to your profile and prepares emails. It can create a
          resume from your profile if needed. Review every message before
          approval.
        </Text>
        <Button
          label={action.busy ? "Working…" : "Find and prepare applications"}
          disabled={action.busy || !query.trim()}
          onPress={() => {
            void action.run(async () => {
              if (
                !Number.isInteger(Number(page)) ||
                Number(page) < 1 ||
                !Number.isInteger(Number(limit)) ||
                Number(limit) < 1 ||
                Number(limit) > 20
              )
                throw new Error(
                  "Enter a positive page and a job count between 1 and 20.",
                );
              setSelected([]);
              setReport(
                await autoApplyApi.run({
                  source,
                  search_query: query.trim(),
                  page: Number(page),
                  limit: Number(limit),
                }),
              );
            });
          }}
        />
      </Card>
      <Feedback {...action} />
      {report && (
        <>
          <Card title="Review your applications">
            <Text style={styles.muted}>
              {report.total_processed} processed · {eligible.length} ready to
              send
            </Text>
            <Toggle
              label="Select all ready applications"
              value={
                eligible.length > 0 &&
                eligible.every((j) => selected.includes(j.application_id!))
              }
              disabled={action.busy}
              onChange={(value) =>
                setSelected(value ? eligible.map((j) => j.application_id!) : [])
              }
            />
            <ScheduleField value={sendAt} onChange={setSendAt} />
            <Button
              label={`${sendAt ? "Approve and schedule" : "Approve and send now"} (${selected.length})`}
              disabled={action.busy || !selected.length}
              onPress={() => {
                void action.run(async () => {
                  const iso = sendAt ? scheduleISO(sendAt) : undefined;
                  if (
                    !(await confirm(
                      iso
                        ? "Schedule selected applications?"
                        : "Send selected applications now?",
                      `${selected.length} emails will ${iso ? "be scheduled for " + new Date(iso).toLocaleString() : "be sent to their recruiters"}.`,
                    ))
                  )
                    return;
                  const failures: string[] = [];
                  for (const applicationId of selected) {
                    try {
                      const preview =
                        await applicationsApi.preview(applicationId);
                      if (!preview.can_send)
                        throw new Error(
                          preview.reason_cannot_send || "Not ready to send",
                        );
                      const app = iso
                        ? await applicationsApi.schedule(applicationId, iso)
                        : await applicationsApi.send(applicationId);
                      setReport(
                        (current) =>
                          current && {
                            ...current,
                            jobs: current.jobs.map((job) =>
                              job.application_id === applicationId
                                ? {
                                    ...job,
                                    status: app.status,
                                    scheduled_at: app.scheduled_at,
                                  }
                                : job,
                            ),
                          },
                      );
                      setSelected((current) =>
                        current.filter((id) => id !== applicationId),
                      );
                      if (app.status !== (iso ? "scheduled" : "sent"))
                        throw new Error(
                          app.notes || `Application status: ${app.status}`,
                        );
                    } catch (err) {
                      failures.push(
                        `#${applicationId}: ${err instanceof Error ? err.message : "Failed"}`,
                      );
                    }
                  }
                  if (failures.length) throw new Error(failures.join("\n"));
                }, "Selected applications processed.");
              }}
            />
            <Text style={styles.muted}>
              Unselected applications remain saved for later review.
            </Text>
          </Card>
          {report.jobs.length === 0 && (
            <Notice text="No opportunities processed. Try a different keyword or source." />
          )}
          {report.jobs.map((job) => (
            <Card key={job.job_id}>
              <Badge value={job.status} />
              <Text style={styles.h2}>{job.title}</Text>
              <Text style={styles.muted}>{job.company}</Text>
              <Text style={styles.text}>
                {job.hr_email || "Recruiter contact needed"}
              </Text>
              <Text style={styles.muted}>
                Resume: {job.resume_used || "None"}
              </Text>
              {!!(job.email_subject) && (
                <Text style={styles.label}>{job.email_subject}</Text>
              )}
              {!!(job.cover_letter_text) && (
                <Text selectable style={styles.muted}>
                  {job.cover_letter_text}
                </Text>
              )}
              <Text style={styles.muted}>{job.message}</Text>
              {!!(job.status === "ready" && job.application_id) && (
                <Toggle
                  label="Apply to this job"
                  disabled={action.busy}
                  value={selected.includes(job.application_id)}
                  onChange={(value) =>
                    setSelected((current) =>
                      value
                        ? [...current, job.application_id!]
                        : current.filter((id) => id !== job.application_id),
                    )
                  }
                />
              )}
              {!!(job.application_id) && (
                <Nav
                  label="Review / edit application →"
                  href={`/applications/${job.application_id}`}
                />
              )}
              <Nav label="View opportunity" href={`/jobs/${job.job_id}`} />
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}
