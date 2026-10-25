import { useState } from "react";
import { Text } from "react-native";
import { emailApi, hrContactsApi, llmApi } from "@/services/api";
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
  Toggle,
  confirm,
  styles,
} from "@/components/ui";
import type { LLMProvider } from "@/types";

function ProviderEditor({
  provider,
  refresh,
}: {
  provider?: LLMProvider;
  refresh: () => Promise<void>;
}) {
  const [vendor, setVendor] = useState<string>(
    provider?.provider || "openrouter",
  );
  const [key, setKey] = useState("");
  const [model, setModel] = useState(provider?.model || "");
  const [priority, setPriority] = useState(String(provider?.priority || 1));
  const [active, setActive] = useState(provider?.active ?? true);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const action = useAction();
  return (
    <Card
      title={
        provider
          ? `${provider.provider} · Priority ${provider.priority}`
          : "Add AI provider"
      }
    >
      <Choice
        label="Provider"
        value={vendor}
        options={["openrouter", "groq", "gemini", "xkiro"].map((value) => ({
          value,
          label: value,
        }))}
        onChange={(value) => {
          setVendor(value);
          setModel("");
        }}
        disabled={action.busy}
      />
      {provider && (
        <Text style={styles.muted}>Saved key: {provider.api_key_preview}</Text>
      )}
      <Field
        label={provider ? "Replace API key (leave blank to keep)" : "API key"}
        secureTextEntry
        value={key}
        onChangeText={setKey}
        editable={!action.busy}
      />
      <Field
        label="Model identifier"
        placeholder="Enter a model available to your account"
        value={model}
        onChangeText={setModel}
        editable={!action.busy}
      />
      <Field
        label="Priority (1 = primary)"
        keyboardType="number-pad"
        value={priority}
        onChangeText={setPriority}
        editable={!action.busy}
      />
      <Toggle
        label="Active"
        value={active}
        onChange={setActive}
        disabled={action.busy}
      />
      <Toggle
        label="Enabled for failover"
        value={enabled}
        onChange={setEnabled}
        disabled={action.busy}
      />
      <Feedback {...action} />
      <Button
        label="Save provider"
        disabled={action.busy || !model.trim() || (!provider && !key.trim())}
        onPress={() => {
          void action.run(async () => {
            if (!Number.isInteger(Number(priority)) || Number(priority) < 1)
              throw new Error("Priority must be a positive whole number.");
            const data = {
              provider: vendor as LLMProvider["provider"],
              model: model.trim(),
              priority: Number(priority),
              active,
              enabled,
            };
            if (provider)
              await llmApi.update(provider.id, {
                ...data,
                ...(key.trim() ? { api_key: key.trim() } : {}),
              });
            else await llmApi.create({ ...data, api_key: key.trim() });
            setKey("");
            await refresh();
          }, "Provider saved.");
        }}
      />
      {provider && (
        <>
          <Button
            secondary
            label="Test saved provider"
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                const result = await llmApi.test(provider.id);
                if (!result.success)
                  throw new Error(result.error || "Provider test failed.");
              }, "Provider connection successful.");
            }}
          />
          <Button
            danger
            label="Delete provider"
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                if (await confirm("Delete provider?", provider.provider)) {
                  await llmApi.delete(provider.id);
                  await refresh();
                }
              });
            }}
          />
        </>
      )}
    </Card>
  );
}
export function Providers() {
  const resource = useResource(llmApi.list);
  return (
    <Page
      title="AI providers"
      subtitle="Connect a model for matching, cover letters, and study plans."
      back
      {...resource}
    >
      {resource.data?.map((provider) => (
        <ProviderEditor
          key={`${provider.id}-${provider.updated_at}`}
          provider={provider}
          refresh={resource.refresh}
        />
      ))}
      <ProviderEditor refresh={resource.refresh} />
    </Page>
  );
}
export function EmailSettings() {
  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
    from_email: "",
  });
  const [tls, setTls] = useState(true);
  const action = useAction();
  const resource = useResource(async () => {
    const data = await emailApi.getSettings();
    if (data) {
      setForm({
        smtp_host: data.smtp_host,
        smtp_port: String(data.smtp_port),
        smtp_username: data.smtp_username,
        smtp_password: "",
        from_email: data.from_email,
      });
      setTls(data.use_tls);
    }
    return data;
  });
  return (
    <Page
      title="Connect your email"
      subtitle="Send applications from your own address."
      back
      {...resource}
    >
      <Card>
        {resource.data?.password_configured && (
          <Badge value="Password configured" />
        )}
        {(
          [
            "smtp_host",
            "smtp_port",
            "smtp_username",
            "smtp_password",
            "from_email",
          ] as const
        ).map((key) => (
          <Field
            key={key}
            label={
              {
                smtp_host: "SMTP host",
                smtp_port: "SMTP port",
                smtp_username: "SMTP username",
                smtp_password: "SMTP password (leave blank to keep saved)",
                from_email: "From email",
              }[key]
            }
            value={form[key]}
            onChangeText={(value) => setForm({ ...form, [key]: value })}
            secureTextEntry={key === "smtp_password"}
            keyboardType={
              key === "smtp_port"
                ? "number-pad"
                : key === "from_email"
                  ? "email-address"
                  : "default"
            }
            editable={!action.busy}
          />
        ))}
        <Toggle
          label="Use TLS"
          value={tls}
          onChange={setTls}
          disabled={action.busy}
        />
        <Text style={styles.muted}>
          For Gmail, use an app password. A blank password keeps your existing
          saved password.
        </Text>
        <Feedback {...action} />
        <Button
          label="Save email settings"
          disabled={
            action.busy ||
            !form.smtp_host ||
            !form.smtp_username ||
            !form.from_email
          }
          onPress={() => {
            void action.run(async () => {
              const port = Number(form.smtp_port);
              if (!Number.isInteger(port) || port < 1 || port > 65535)
                throw new Error("Enter a valid SMTP port.");
              await emailApi.updateSettings({
                smtp_host: form.smtp_host.trim(),
                smtp_port: port,
                smtp_username: form.smtp_username.trim(),
                from_email: form.from_email.trim(),
                use_tls: tls,
                ...(form.smtp_password
                  ? { smtp_password: form.smtp_password }
                  : {}),
              });
              await resource.refresh();
            }, "Email settings saved.");
          }}
        />
        <Button
          secondary
          label="Test saved SMTP connection"
          disabled={action.busy || !resource.data}
          onPress={() => {
            void action.run(async () => {
              const result = await emailApi.testConnection();
              if (!result.success)
                throw new Error(result.error || result.message);
            }, "SMTP connection successful.");
          }}
        />
      </Card>
    </Page>
  );
}
export function HRContacts() {
  const resource = useResource(async () => {
    const [contacts, required] = await Promise.all([
      hrContactsApi.list(),
      hrContactsApi.listRequiredJobs(),
    ]);
    return { contacts, required };
  });
  const action = useAction();
  const [jobId, setJobId] = useState(0);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Page
      title="Recruiter contacts"
      subtitle="Add missing contacts to move applications forward."
      back
      {...resource}
    >
      <Card title="Add a contact">
        <Choice
          label="Opportunity needing a contact"
          value={jobId}
          options={[
            { value: 0, label: "Choose a job" },
            ...(resource.data?.required.map((job) => ({
              value: job.id,
              label: `${job.title} · ${job.company}`,
            })) || []),
          ]}
          onChange={setJobId}
        />
        <Field
          label="Recruiter email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Field label="Contact name" value={name} onChangeText={setName} />
        <Field label="Phone" value={phone} onChangeText={setPhone} />
        <Field label="Notes" multiline value={notes} onChangeText={setNotes} />
        <Feedback {...action} />
        <Button
          label="Save contact"
          disabled={action.busy || !jobId || !email.trim()}
          onPress={() => {
            void action.run(async () => {
              await hrContactsApi.create({
                job_id: jobId,
                company: resource.data?.required.find((j) => j.id === jobId)
                  ?.company,
                email: email.trim(),
                contact_name: name || undefined,
                phone: phone || undefined,
                notes: notes || undefined,
              });
              setEmail("");
              setName("");
              setPhone("");
              setNotes("");
              setJobId(0);
              await resource.refresh();
            }, "Contact saved.");
          }}
        />
      </Card>
      {resource.data && !resource.data.required.length && (
        <Empty text="All opportunities have their recruiter contacts." />
      )}
      {resource.data?.required.map((job) => (
        <Card key={job.id}>
          <Text style={styles.h2}>{job.title}</Text>
          <Text style={styles.muted}>{job.company}</Text>
          <Nav label="Open opportunity" href={`/jobs/${job.id}`} />
        </Card>
      ))}
      <Text style={styles.h2}>Saved contacts</Text>
      {resource.data?.contacts.map((contact) => (
        <Card key={contact.id}>
          <Text style={styles.h2}>
            {contact.company || contact.contact_name || contact.email}
          </Text>
          <Text style={styles.text}>{contact.email}</Text>
          <Text style={styles.muted}>
            {[contact.contact_name, contact.phone, contact.notes]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Nav label="View opportunity" href={`/jobs/${contact.job_id}`} />
          <Button
            danger
            label="Delete contact"
            disabled={action.busy}
            onPress={() => {
              void action.run(async () => {
                if (await confirm("Delete contact?", contact.email)) {
                  await hrContactsApi.delete(contact.id);
                  await resource.refresh();
                }
              });
            }}
          />
        </Card>
      ))}
    </Page>
  );
}
