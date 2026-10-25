import { useState } from "react";
import { Text, View } from "react-native";
import type { Href } from "expo-router";
import {
  applicationsApi,
  profileApi,
  resumesApi,
  jobTitlesApi,
  llmApi,
  emailApi,
} from "@/services/api";
import { useAction, useResource } from "@/hooks/use-resource";
import { useSession } from "@/providers/session";
import {
  Badge,
  Button,
  Card,
  Empty,
  Feedback,
  Field,
  Nav,
  Page,
  Toggle,
  confirm,
  styles,
} from "@/components/ui";
import type { JobTitle, UserProfile } from "@/types";

export function Dashboard() {
  const resource = useResource(async () => {
    const [stats, apps, profile, titles, resumes, llm, email] =
      await Promise.all([
        applicationsApi.getDashboardStats(),
        applicationsApi.list(),
        profileApi.getProfile(),
        jobTitlesApi.list(),
        resumesApi.list(),
        llmApi.list(),
        emailApi.getSettings(),
      ]);
    return {
      stats,
      apps,
      profile,
      setup: [
        !!profile.name,
        titles.some((t) => t.active),
        resumes.some((r) => r.active),
        llm.some((p) => p.active && p.enabled),
        !!email?.password_configured,
      ],
    };
  });
  const { data } = resource;
  return (
    <Page
      title={
        data?.profile.name
          ? `Welcome back, ${data.profile.name.split(" ")[0]}.`
          : "Your next chapter starts here."
      }
      subtitle="A clear view of your opportunities and what to do next."
      {...resource}
    >
      <View style={styles.row}>
        {[
          ["Jobs discovered", data?.stats.total_jobs, "/jobs"],
          [
            "Ready to send",
            data?.stats.applications_ready,
            "/applications?status=ready",
          ],
          [
            "Applications sent",
            data?.stats.applications_sent,
            "/applications?status=sent",
          ],
          ["Contacts needed", data?.stats.hr_contacts_required, "/hr-contacts"],
        ].map(([label, value, href]) => (
          <View
            key={label}
            style={[styles.card, { width: "48%", flexGrow: 1 }]}
          >
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.metric}>{value ?? "—"}</Text>
            <Nav label="View →" href={href as Href} />
          </View>
        ))}
      </View>
      <View style={[styles.card, { backgroundColor: "#edf4ee" }]}>
        <Text style={styles.eyebrow}>Make your next move</Text>
        <Text style={styles.title}>
          Good opportunities.{"\n"}Thoughtful applications.
        </Text>
        <Text style={styles.muted}>
          Explore roles from Infopark, Technopark, Cyberpark, UL CyberPark, and
          SmartCity.
        </Text>
        <Nav label="Explore opportunities →" href="/jobs" />
        <Nav label="Find and prepare with AI" href="/auto-apply" />
      </View>
      <Card title="Your workspace setup">
        <Text style={styles.muted}>
          {data?.setup.filter(Boolean).length ?? 0} of 5 steps complete
        </Text>
        {[
          ["Complete your profile", "/profile"],
          ["Choose your target roles", "/job-titles"],
          ["Add a resume", "/resumes"],
          ["Connect an AI provider", "/llm-providers"],
          ["Connect your email", "/email-settings"],
        ].map(([label, href], index) => (
          <Nav
            key={href}
            label={`${data?.setup[index] ? "✓" : "○"} ${label}`}
            href={href as Href}
          />
        ))}
      </Card>
      <Text style={styles.h2}>Recent applications</Text>
      {data?.apps.slice(0, 5).map((app) => (
        <Card key={app.id}>
          <Text style={styles.h2}>{app.job?.title}</Text>
          <Text style={styles.muted}>{app.job?.company}</Text>
          <Badge value={app.status} />
          <Nav label="View application →" href={`/applications/${app.id}`} />
        </Card>
      ))}
      {data && !data.apps.length && (
        <Empty text="Find a role you like and prepare your first application. Your progress will appear here." />
      )}
    </Page>
  );
}
export function More() {
  const { user, signOut } = useSession();
  const action = useAction();
  return (
    <Page title="Your workspace" subtitle={user?.email}>
      <Card title="Workspace">
        <Nav label="Auto apply" href="/auto-apply" />
        <Nav label="Manual apply" href="/manual-apply" />
        <Nav label="Add already applied" href="/external-application" />
        <Nav label="Recruiter contacts" href="/hr-contacts" />
      </Card>
      <Card title="Your toolkit">
        <Nav label="My resumes" href="/resumes" />
        <Nav label="Target roles" href="/job-titles" />
        <Nav label="Interviews & outcomes" href="/interviews" />
        <Nav label="Learning" href="/learning" />
      </Card>
      <Card title="Settings">
        <Nav label="My profile" href="/profile" />
        <Nav label="AI providers" href="/llm-providers" />
        <Nav label="Email settings" href="/email-settings" />
      </Card>
      <Feedback {...action} />
      <Button
        label="Sign out"
        secondary
        disabled={action.busy}
        onPress={() => {
          void action.run(signOut);
        }}
      />
    </Page>
  );
}
const profileFields: [keyof UserProfile, string][] = [
  ["name", "Full name"],
  ["phone", "Phone"],
  ["current_company", "Current company"],
  ["location", "Location"],
  ["current_ctc", "Current CTC"],
  ["expected_ctc", "Expected CTC"],
  ["years_of_experience", "Years of experience"],
  ["notice_period", "Notice period"],
  ["linkedin_url", "LinkedIn URL"],
  ["github_url", "GitHub URL"],
  ["portfolio_url", "Portfolio URL"],
  ["additional_details", "Additional details"],
];
export function Profile() {
  const [form, setForm] = useState<Record<string, string>>({});
  const action = useAction();
  const resource = useResource(async () => {
    const data = await profileApi.getProfile();
    setForm(
      Object.fromEntries(
        profileFields.map(([key]) => [key, String(data[key] ?? "")]),
      ),
    );
    return data;
  });
  return (
    <Page
      title="Your profile"
      subtitle="Bring your experience to every application."
      back
      {...resource}
    >
      {resource.data && (
        <Card>
          {profileFields.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={form[key] || ""}
              keyboardType={
                key === "years_of_experience" ? "decimal-pad" : "default"
              }
              multiline={key === "additional_details"}
              editable={!action.busy}
              onChangeText={(value) => setForm({ ...form, [key]: value })}
            />
          ))}
          <Feedback {...action} />
          <Button
            label="Save profile"
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                const years = form.years_of_experience;
                if (
                  years &&
                  (!Number.isFinite(Number(years)) || Number(years) < 0)
                )
                  throw new Error("Enter valid years of experience.");
                await profileApi.updateProfile({
                  ...form,
                  years_of_experience: years ? Number(years) : undefined,
                });
              }, "Profile saved.");
            }}
          />
        </Card>
      )}
    </Page>
  );
}
function TitleEditor({
  item,
  refresh,
}: {
  item: JobTitle;
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const action = useAction();
  return (
    <Card>
      <Field
        label="Target role"
        value={title}
        onChangeText={setTitle}
        editable={!action.busy}
      />
      <Toggle
        label="Active"
        value={item.active}
        disabled={action.busy}
        onChange={(active) => {
          void action.run(async () => {
            await jobTitlesApi.update(item.id, { active });
            await refresh();
          });
        }}
      />
      <Feedback {...action} />
      <Button
        secondary
        label="Save role"
        disabled={action.busy || !title.trim()}
        onPress={() => {
          void action.run(async () => {
            await jobTitlesApi.update(item.id, { title: title.trim() });
            await refresh();
          }, "Role saved.");
        }}
      />
      <Button
        danger
        label="Delete role"
        disabled={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (await confirm("Delete role?", item.title)) {
              await jobTitlesApi.delete(item.id);
              await refresh();
            }
          });
        }}
      />
    </Card>
  );
}
export function JobTitles() {
  const resource = useResource(jobTitlesApi.list);
  const action = useAction();
  const [title, setTitle] = useState("");
  return (
    <Page
      title="Target roles"
      subtitle="Tell us what you are looking for."
      back
      {...resource}
    >
      <Card>
        <Field label="New job title" value={title} onChangeText={setTitle} />
        <Feedback {...action} />
        <Button
          label="Add role"
          disabled={action.busy || !title.trim()}
          onPress={() => {
            void action.run(async () => {
              await jobTitlesApi.create(title.trim());
              setTitle("");
              await resource.refresh();
            });
          }}
        />
      </Card>
      {resource.data?.map((item) => (
        <TitleEditor key={item.id} item={item} refresh={resource.refresh} />
      ))}
    </Page>
  );
}
