import { InterviewTrackingPanel } from '@/screens/interviews';
import { progressLabels } from '@/services/interviews';
import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { applicationsApi, resumesApi, hrContactsApi } from "@/services/api";
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
  Notice,
  Page,
  ScheduleField,
  confirm,
  labels,
  scheduleISO,
  styles,
} from "@/components/ui";
import { FollowUps, InterviewPreparation } from "@/screens/preparation";
import { SkillGaps } from "@/screens/learning";

export function Applications() {
  const { status = "" } = useLocalSearchParams<{ status?: string }>();
  const setStatus = (value: string) => router.setParams({ status: value });
  const resource = useResource(
    () => applicationsApi.list(status || undefined),
    status,
  );
  return (
    <Page
      title="Your applications"
      subtitle="From first introduction to your next interview."
      {...resource}
    >
      <Nav label="Interviews & outcomes" href="/interviews" />
      <Nav label="Add already applied +" href="/external-application" />
      <Choice
        label="Status"
        value={status}
        options={[
          "",
          "ready",
          "scheduled",
          "sending",
          "sent",
          "hr_contact_required",
          "draft",
          "failed",
          "cancelled",
          "applied_externally",
        ].map((value) => ({
          value,
          label: value
            ? labels[value] || value[0].toUpperCase() + value.slice(1)
            : "All",
        }))}
        onChange={setStatus}
      />
      {resource.data?.map((app) => (
        <Card key={app.id}>
          <Text style={styles.h2}>
            {app.job?.title || `Application #${app.id}`}
          </Text>
          <Text style={styles.muted}>{app.job?.company}</Text>
          <Badge value={app.status} />
          {["sent", "applied_externally"].includes(app.status) && <Text style={styles.muted}>{progressLabels[app.hiring_progress]}</Text>}
          {!!(app.scheduled_at) && (
            <Text style={styles.muted}>
              Scheduled: {new Date(app.scheduled_at).toLocaleString()}
            </Text>
          )}
          {!!(app.applied_on) && (
            <Text style={styles.muted}>
              Applied {app.applied_on} · {app.application_method}
            </Text>
          )}
          <Nav label="View application →" href={`/applications/${app.id}`} />
        </Card>
      ))}
      {resource.data && !resource.data.length && (
        <Empty text="No applications in this view. Find an opportunity or record an application submitted elsewhere." />
      )}
    </Page>
  );
}
export function ApplicationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = Number(id);
  const action = useAction();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [resumeId, setResumeId] = useState(0);
  const [notes, setNotes] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [contactId, setContactId] = useState(0);
  const resource = useResource(async () => {
    const app = await applicationsApi.get(applicationId);
    const [resumes, contacts, preview] = await Promise.all([
      resumesApi.list(),
      hrContactsApi.list(),
      app.status === "applied_externally"
        ? Promise.resolve(null)
        : applicationsApi.preview(applicationId),
    ]);
    setSubject(preview?.email_subject || app.email_subject || "");
    setBody(preview?.cover_letter_text || app.cover_letter?.content || "");
    setResumeId(app.resume_id || 0);
    setNotes(app.notes || "");
    setContactId(app.hr_contact_id || 0);
    return { app, resumes, contacts, preview };
  }, applicationId);
  const app = resource.data?.app;
  const external = app?.status === "applied_externally";
  const locked = [
    "sent",
    "scheduled",
    "sending",
    "applied_externally",
  ].includes(app?.status || "");
  const save = async () =>
    applicationsApi.update(
      applicationId,
      external
        ? { notes }
        : {
            email_subject: subject.trim(),
            cover_letter_content: body.trim(),
            resume_id: resumeId || null,
            ...(contactId ? { hr_contact_id: contactId } : {}),
            notes,
          },
    );
  const approve = () => {
    void action.run(async () => {
      if (
        !(await confirm(
          sendAt ? "Schedule application?" : "Send application now?",
          `${subject}\n\nYour latest message and selected resume will be saved and sent to the recruiter.`,
        ))
      )
        return;
      const iso = sendAt ? scheduleISO(sendAt) : undefined;
      await save();
      const preview = await applicationsApi.preview(applicationId);
      if (!preview.can_send)
        throw new Error(
          preview.reason_cannot_send ||
            "This application is not ready to send.",
        );
      const result = iso
        ? await applicationsApi.schedule(applicationId, iso)
        : await applicationsApi.send(applicationId);
      await resource.refresh();
      if (result.status !== (iso ? "scheduled" : "sent"))
        throw new Error(
          result.notes ||
            "The application was not sent. Check its status and email settings.",
        );
    });
  };
  return (
    <Page
      title={app?.job?.title || "Application review"}
      subtitle={app?.job?.company}
      back
      {...resource}
    >
      {app && (
        <>
          <Card
            title={external ? "Applied elsewhere" : "Review your application"}
          >
            <Badge value={app.status} />
            {!!(app.scheduled_at) && (
              <Text style={styles.text}>
                Scheduled: {new Date(app.scheduled_at).toLocaleString()}
              </Text>
            )}
            {!!(app.sent_at) && (
              <Text style={styles.muted}>
                Sent {new Date(app.sent_at).toLocaleString()} to {app.sent_to}
              </Text>
            )}
            {external ? (
              <>
                <Text style={styles.text}>
                  Applied {app.applied_on} via {app.application_method}
                </Text>
                <Text style={styles.muted}>{app.job?.description}</Text>
                <Text style={styles.muted}>
                  {app.job?.contact_email || "No recruiter contact saved"}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.text}>
                  To:{" "}
                  {resource.data?.preview?.recipient_email ||
                    "Recruiter contact needed"}
                </Text>
                {!locked && (
                  <>
                    <Choice
                      label="Recruiter contact"
                      value={contactId}
                      options={[
                        { value: 0, label: "Listing contact" },
                        ...(resource.data?.contacts
                          .filter((c) => c.job_id === app.job_id)
                          .map((c) => ({ value: c.id, label: c.email })) || []),
                      ]}
                      onChange={setContactId}
                    />
                    <Nav
                      label="Manage recruiter contact"
                      href={`/jobs/${app.job_id}`}
                    />
                  </>
                )}
                <Field
                  label="Email subject"
                  value={subject}
                  onChangeText={setSubject}
                  editable={!locked && !action.busy}
                />
                <Choice
                  label="Resume attachment"
                  value={resumeId}
                  options={[
                    { value: 0, label: "No attachment" },
                    ...(resource.data?.resumes.map((r) => ({
                      value: r.id,
                      label: r.title,
                    })) || []),
                  ]}
                  onChange={setResumeId}
                  disabled={locked || action.busy}
                />
                <Field
                  label="Cover letter"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  editable={!locked && !action.busy}
                />
                {!!(resource.data?.preview?.reason_cannot_send) && (
                  <Notice text={resource.data.preview.reason_cannot_send} />
                )}
              </>
            )}
            <Field
              label="Tracking notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              editable={(external || !locked) && !action.busy}
            />
            <Feedback {...action} />
            {(external || !locked) && (
              <Button
                secondary
                label="Save changes"
                disabled={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await save();
                    await resource.refresh();
                  }, "Changes saved.");
                }}
              />
            )}
            {!locked && (
              <>
                <ScheduleField value={sendAt} onChange={setSendAt} />
                <Button
                  label={
                    sendAt ? "Approve and schedule" : "Approve and send now"
                  }
                  disabled={action.busy || !subject.trim() || !body.trim()}
                  onPress={approve}
                />
              </>
            )}
            {app.status === "scheduled" && (
              <Button
                danger
                label="Cancel scheduled send"
                disabled={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    if (
                      await confirm(
                        "Cancel scheduled send?",
                        "The application will remain saved for later review.",
                      )
                    ) {
                      await applicationsApi.cancelSchedule(applicationId);
                      await resource.refresh();
                    }
                  });
                }}
              />
            )}
            {app.status === "sending" && (
              <Notice text="This application is being sent. Refresh to check its status." />
            )}
          </Card>
          {app.status === "sent" && <FollowUps application={app} />}
          {["sent", "applied_externally"].includes(app.status) && <InterviewTrackingPanel key={app.id} applicationId={app.id} />}
          <InterviewPreparation
            application={app}
            resumes={resource.data?.resumes || []}
          />
          <SkillGaps jobId={app.job_id} resumeId={resumeId} />
        </>
      )}
    </Page>
  );
}
