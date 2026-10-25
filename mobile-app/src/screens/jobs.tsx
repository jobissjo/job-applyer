import { useRef, useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  applicationsApi,
  jobsApi,
  resumesApi,
  hrContactsApi,
} from "@/services/api";
import { jobSources, jobSourceLabel } from "@/services/jobSources";
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
  localDate,
  openLink,
  styles,
} from "@/components/ui";
import { SkillGaps } from "@/screens/learning";
import type { JobAnalyzeResponse } from "@/types";

export function Jobs() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const resource = useResource(
    () => jobsApi.list({ query: search, source, page, limit: 20 }),
    `${page}:${source}:${search}`,
  );
  return (
    <Page
      title="Find your next opportunity"
      subtitle="Explore roles and put your experience forward."
      {...resource}
    >
      <Card>
        <Field
          label="Search jobs"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            setPage(1);
            setSearch(query.trim());
          }}
          returnKeyType="search"
        />
        <Choice
          label="Source"
          value={source}
          options={[{ value: "", label: "All sources" }, ...jobSources]}
          onChange={(value) => {
            setSource(value);
            setPage(1);
          }}
        />
        <Button
          label="Search"
          disabled={resource.loading}
          onPress={() => {
            setPage(1);
            setSearch(query.trim());
          }}
        />
        <Nav label="Apply for a job found elsewhere" href="/manual-apply" />
      </Card>
      {resource.data && (
        <Text style={styles.muted}>
          {resource.data.total} opportunities · Page {resource.data.page}
        </Text>
      )}
      {resource.data?.items.map((job) => (
        <Card key={job.id}>
          <Badge value={jobSourceLabel(job.source)} />
          <Text style={styles.h2}>{job.title}</Text>
          <Text style={styles.muted}>
            {job.company} · {job.location || "Location not listed"}
          </Text>
          {!!(job.application_status) && <Badge value={job.application_status} />}
          <Text numberOfLines={3} style={styles.muted}>
            {job.description || "Open this opportunity to see more."}
          </Text>
          <Nav label="View opportunity →" href={`/jobs/${job.id}`} />
        </Card>
      ))}
      {resource.data && !resource.data.items.length && (
        <Empty text="No jobs found. Try another keyword or use Auto apply to discover opportunities." />
      )}
      {page > 1 && (
        <Button
          label="Previous page"
          secondary
          disabled={resource.loading}
          onPress={() => setPage(page - 1)}
        />
      )}
      {resource.data?.has_next && (
        <Button
          label="Next page"
          secondary
          disabled={resource.loading}
          onPress={() => setPage(page + 1)}
        />
      )}
    </Page>
  );
}

export function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const action = useAction();
  const [analysis, setAnalysis] = useState<JobAnalyzeResponse>();
  const [resumeId, setResumeId] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [instructions, setInstructions] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const resource = useResource(async () => {
    const [job, resumes, contacts] = await Promise.all([
      jobsApi.get(jobId),
      resumesApi.list(),
      hrContactsApi.list(),
    ]);
    setSubject((current) => current || "Application for " + job.title);
    const contact =
      contacts.find((c) => c.job_id === jobId)?.email ||
      job.contact_email ||
      "";
    setSavedEmail(contact);
    setEmail(contact);
    return { job, resumes };
  }, jobId);
  const job = resource.data?.job;
  return (
    <Page
      title={job?.title || "Opportunity"}
      subtitle={
        job ? `${job.company} · ${job.location || "Location not listed"}` : ""
      }
      back
      {...resource}
    >
      {job && (
        <>
          <Card title="About the opportunity">
            <Badge value={jobSourceLabel(job.source)} />
            <Text selectable style={styles.text}>
              {job.description || "No description supplied."}
            </Text>
            {!!(job.requirements) && (
              <Text selectable style={styles.text}>
                {job.requirements}
              </Text>
            )}
            {!!((job.detail_url || job.job_url)) && (
              <Button
                secondary
                label="Open original listing ↗"
                onPress={() => {
                  void action.run(() =>
                    openLink(job.detail_url || job.job_url),
                  );
                }}
              />
            )}
          </Card>
          <Feedback {...action} />
          {job.application_status === "applied_externally" ? (
            <Notice text="This role is saved as applied elsewhere. Open Applications to manage its notes and interview preparation." />
          ) : (
            <>
              <Card title="Recruiter contact">
                {savedEmail ? (
                  <Text style={styles.text}>{savedEmail}</Text>
                ) : (
                  <>
                    <Field
                      label="Recruiter email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                    />
                    <Button
                      secondary
                      label="Save contact"
                      disabled={action.busy || !email.trim()}
                      onPress={() => {
                        void action.run(async () => {
                          const contact = await hrContactsApi.create({
                            job_id: jobId,
                            company: job.company,
                            email: email.trim(),
                          });
                          setSavedEmail(contact.email);
                        });
                      }}
                    />
                  </>
                )}
              </Card>
              <Card title="1. Find your fit">
                <Button
                  secondary
                  label="Analyze match"
                  disabled={action.busy}
                  onPress={() => {
                    void action.run(async () => {
                      const result = await jobsApi.analyze(jobId);
                      setAnalysis(result);
                      if (result.recommended_resume_id)
                        setResumeId(result.recommended_resume_id);
                    });
                  }}
                />
                {analysis && (
                  <>
                    <Badge value={`${analysis.match_score}% match`} />
                    <Text style={styles.text}>{analysis.reason}</Text>
                  </>
                )}
              </Card>
              <Card title="2. Make it personal">
                <Choice
                  label="Your resume"
                  value={resumeId}
                  options={[
                    { value: 0, label: "No attachment" },
                    ...(resource.data?.resumes
                      .filter((r) => r.active)
                      .map((r) => ({ value: r.id, label: r.title })) || []),
                  ]}
                  onChange={setResumeId}
                  disabled={action.busy}
                />
                <Nav label="Manage resumes" href="/resumes" />
                <Field
                  label="Email subject"
                  value={subject}
                  onChangeText={setSubject}
                  editable={!action.busy}
                />
                <Field
                  label="Instructions for AI (optional)"
                  value={instructions}
                  onChangeText={setInstructions}
                  editable={!action.busy}
                />
                <Button
                  secondary
                  label="Write with AI"
                  disabled={action.busy}
                  onPress={() => {
                    void action.run(async () => {
                      const letter = await jobsApi.generateCoverLetter(jobId, {
                        resume_id: resumeId || undefined,
                        job_title_id: analysis?.job_title_id,
                        custom_instructions: instructions || undefined,
                      });
                      setBody(letter.content);
                    });
                  }}
                />
                <Field
                  label="Cover letter"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  editable={!action.busy}
                />
              </Card>
              <Card title="3. Review before sending">
                <Text style={styles.muted}>
                  Save your application, then review the recipient, message, and
                  resume on the next screen.
                </Text>
                <Button
                  label="Review application →"
                  disabled={action.busy || !subject.trim() || !body.trim()}
                  onPress={() => {
                    void action.run(async () => {
                      const application = await applicationsApi.create({
                        job_id: jobId,
                        resume_id: resumeId || undefined,
                        email_subject: subject.trim(),
                        cover_letter_content: body.trim(),
                      });
                      router.push(`/applications/${application.id}`);
                    });
                  }}
                />
              </Card>
            </>
          )}
          <SkillGaps jobId={jobId} resumeId={resumeId} />
        </>
      )}
    </Page>
  );
}

export function ManualApply({ external = false }: { external?: boolean }) {
  const action = useAction();
  const requestId = useRef(Crypto.randomUUID());
  const [form, setForm] = useState({
    role: "",
    company: "",
    email: "",
    description: "",
    job_url: "",
    applied_on: localDate(),
    application_method: "Company website",
    contact_name: "",
    contact_phone: "",
    notes: "",
  });
  const field = (key: keyof typeof form, label: string, multiline = false) => (
    <Field
      key={key}
      label={label}
      value={form[key]}
      onChangeText={(value) => setForm({ ...form, [key]: value })}
      multiline={multiline}
      editable={!action.busy}
      keyboardType={key === "email" ? "email-address" : "default"}
    />
  );
  return (
    <Page
      title={external ? "Add already applied" : "Manual apply"}
      subtitle={
        external
          ? "Track an application you submitted elsewhere."
          : "Found a role elsewhere? Prepare your introduction here."
      }
      back
    >
      <Card>
        {field("role", "Role *")}
        {field("company", external ? "Company *" : "Company")}
        {field(
          "email",
          external ? "Recruiter email (optional)" : "Recruiter email *",
        )}
        {field(
          "description",
          external ? "Job description" : "Job description *",
          true,
        )}
        {field("job_url", "Listing link")}
        {external && (
          <>
            {field("applied_on", "Applied on (YYYY-MM-DD) *")}
            {field("application_method", "How you applied *")}
            {field("contact_name", "Contact name")}
            {field("contact_phone", "Contact phone")}
            {field("notes", "Tracking notes", true)}
            <Notice text="This record is for tracking. No application email will be sent or scheduled." />
          </>
        )}
        <Feedback {...action} />
        <Button
          label={external ? "Save application" : "Continue to prepare →"}
          disabled={
            action.busy ||
            !form.role.trim() ||
            (external
              ? !form.company.trim() || !form.application_method.trim()
              : !form.email.trim() || !form.description.trim())
          }
          onPress={() => {
            void action.run(async () => {
              if (external) {
                const result = await applicationsApi.recordExternal({
                  request_id: requestId.current,
                  role: form.role.trim(),
                  company: form.company.trim(),
                  applied_on: form.applied_on,
                  application_method: form.application_method,
                  contact_email: form.email || undefined,
                  contact_name: form.contact_name || undefined,
                  contact_phone: form.contact_phone || undefined,
                  job_url: form.job_url || undefined,
                  description: form.description || undefined,
                  notes: form.notes || undefined,
                });
                router.replace(`/applications/${result.id}`);
              } else {
                const job = await jobsApi.createManual({
                  request_id: requestId.current,
                  role: form.role.trim(),
                  email: form.email.trim(),
                  description: form.description.trim(),
                  company: form.company || undefined,
                  job_url: form.job_url || undefined,
                });
                router.replace(`/jobs/${job.id}`);
              }
            });
          }}
        />
      </Card>
    </Page>
  );
}
