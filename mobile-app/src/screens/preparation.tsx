import { useRef, useState } from "react";
import { Text } from "react-native";
import * as Crypto from "expo-crypto";
import { followUpsApi, interviewPreparationApi } from "@/services/api";
import { useAction, useResource } from "@/hooks/use-resource";
import {
  Badge,
  Button,
  Card,
  Choice,
  Feedback,
  Field,
  Notice,
  ScheduleField,
  Toggle,
  confirm,
  scheduleISO,
  styles,
} from "@/components/ui";
import type { Application, Resume } from "@/types";

export function FollowUps({ application }: { application: Application }) {
  const resource = useResource(() => followUpsApi.list(application.id));
  const action = useAction();
  const requestId = useRef(Crypto.randomUUID());
  const [done, setDone] = useState(false);
  const [subject, setSubject] = useState(
    `Follow-up: ${application.email_subject || application.job?.title || "Application"}`,
  );
  const [body, setBody] = useState(
    `Dear Hiring Team,\n\nI am following up on my application for the ${application.job?.title || "advertised"} position${application.job?.company ? " at " + application.job.company : ""}. I remain interested in the opportunity and would appreciate any update on my application.\n\nPlease let me know if there is any additional information I can provide. Thank you for your time and consideration.\n\nBest regards`,
  );
  const [attach, setAttach] = useState(false);
  const [sendAt, setSendAt] = useState("");
  const changed = () => {
    requestId.current = Crypto.randomUUID();
    setDone(false);
  };
  return (
    <Card title="Keep the conversation going">
      <Text style={styles.muted}>
        Review your follow-up to{" "}
        {application.sent_to || "the original recruiter"}.
      </Text>
      <Field
        label="Follow-up subject"
        value={subject}
        onChangeText={(value) => {
          changed();
          setSubject(value);
        }}
        editable={!action.busy}
      />
      <Field
        label="Follow-up message"
        multiline
        value={body}
        onChangeText={(value) => {
          changed();
          setBody(value);
        }}
        editable={!action.busy}
      />
      <Toggle
        label="Attach original resume"
        value={attach}
        disabled={action.busy || !application.resume_id}
        onChange={(value) => {
          changed();
          setAttach(value);
        }}
      />
      <ScheduleField
        value={sendAt}
        onChange={(value) => {
          changed();
          setSendAt(value);
        }}
      />
      <Feedback {...action} />
      <Button
        label={
          done
            ? "Follow-up saved"
            : sendAt
              ? "Approve and schedule follow-up"
              : "Approve and send follow-up"
        }
        disabled={action.busy || done || !subject.trim() || !body.trim()}
        onPress={() => {
          void action.run(async () => {
            const scheduled_at = sendAt ? scheduleISO(sendAt) : undefined;
            if (
              !(await confirm(
                scheduled_at ? "Schedule follow-up?" : "Send follow-up now?",
                `To: ${application.sent_to}\n${subject}`,
              ))
            )
              return;
            const result = await followUpsApi.send(application.id, {
              request_id: requestId.current,
              subject: subject.trim(),
              body: body.trim(),
              attach_resume: attach,
              scheduled_at,
            });
            await resource.refresh();
            if (result.status === "failed") {
              requestId.current = Crypto.randomUUID();
              throw new Error(
                result.error_message ||
                  "Follow-up failed. Check your email settings.",
              );
            }
            setDone(true);
          });
        }}
      />
      <Text style={styles.h2}>Follow-up history</Text>
      {!!(resource.error) && <Notice text={resource.error} error />}
      <Button
        secondary
        label="Refresh follow-ups"
        disabled={resource.loading}
        onPress={() => {
          void resource.refresh();
        }}
      />
      {resource.data?.map((item) => (
        <Card key={item.id}>
          <Badge value={item.status} />
          <Text style={styles.text}>{item.subject}</Text>
          <Text style={styles.muted}>{item.recipient}</Text>
          <Text selectable style={styles.muted}>
            {item.body}
          </Text>
          {!!((item.scheduled_at || item.sent_at)) && (
            <Text style={styles.muted}>
              {new Date(item.scheduled_at || item.sent_at!).toLocaleString()}
            </Text>
          )}
          {!!(item.error_message) && <Notice error text={item.error_message} />}
          {item.status === "scheduled" && (
            <Button
              danger
              label="Cancel follow-up"
              disabled={action.busy}
              onPress={() => {
                void action.run(async () => {
                  if (await confirm("Cancel follow-up?", item.subject)) {
                    await followUpsApi.cancel(application.id, item.id);
                    await resource.refresh();
                  }
                });
              }}
            />
          )}
        </Card>
      ))}
    </Card>
  );
}
export function InterviewPreparation({
  application,
  resumes,
}: {
  application: Application;
  resumes: Resume[];
}) {
  const resource = useResource(() =>
    interviewPreparationApi.get(application.id),
  );
  const action = useAction();
  const [resumeId, setResumeId] = useState(application.resume_id || 0);
  const [context, setContext] = useState("");
  const plan = resource.data;
  return (
    <Card title="Prepare for interview">
      <Text style={styles.muted}>
        Build a saved study plan from this role and your experience.
      </Text>
      <Choice
        label="Resume (optional)"
        value={resumeId}
        options={[
          { value: 0, label: "Profile only" },
          ...resumes.map((r) => ({ value: r.id, label: r.title })),
        ]}
        onChange={setResumeId}
        disabled={action.busy}
      />
      <Field
        label="Interview context"
        placeholder="Round, date, available study time…"
        value={context}
        onChangeText={setContext}
        multiline
        editable={!action.busy}
      />
      {!!(resource.error) && (
        <Notice
          error
          text={resource.error}
          retry={() => {
            void resource.refresh();
          }}
        />
      )}
      <Feedback {...action} />
      <Button
        secondary
        label={plan ? "Replace study plan" : "Generate study plan"}
        disabled={action.busy || resource.loading || !!resource.error}
        onPress={() => {
          void action.run(async () => {
            if (
              plan &&
              !(await confirm(
                "Replace study plan?",
                "This replaces your saved checklist and completion progress.",
              ))
            )
              return;
            const result = await interviewPreparationApi.generate(
              application.id,
              {
                resume_id: resumeId || null,
                context,
                replace_generation: plan?.generation_id,
              },
            );
            resource.setData(result);
          });
        }}
      />
      {plan && (
        <>
          <Text style={styles.text}>{plan.summary}</Text>
          <Text style={styles.muted}>
            {plan.sections.filter((s) => s.completed).length} of{" "}
            {plan.sections.length} sections completed
          </Text>
          {plan.sections.map((section) => (
            <Card key={section.id} title={section.title}>
              <Badge value={section.priority} />
              <Text style={styles.muted}>
                {section.reason} · {section.estimated_minutes} min
              </Text>
              <Toggle
                label="Completed"
                value={section.completed}
                disabled={action.busy}
                onChange={(completed) => {
                  void action.run(async () => {
                    resource.setData(
                      await interviewPreparationApi.setCompleted(
                        application.id,
                        section.id,
                        plan.generation_id,
                        completed,
                      ),
                    );
                  });
                }}
              />
              <Text style={styles.label}>Study topics</Text>
              {section.topics.map((topic, i) => (
                <Text key={i} style={styles.text}>
                  • {topic}
                </Text>
              ))}
              <Text style={styles.label}>Practice tasks</Text>
              {section.practice_tasks.map((task, i) => (
                <Text key={i} style={styles.text}>
                  • {task}
                </Text>
              ))}
              <Text style={styles.label}>Sample questions</Text>
              {section.questions.map((question, i) => (
                <Card key={i}>
                  <Text style={styles.text}>{question.question}</Text>
                  <Text style={styles.muted}>{question.answer_guide}</Text>
                </Card>
              ))}
            </Card>
          ))}
        </>
      )}
    </Card>
  );
}
