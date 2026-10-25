import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAction, useResource } from '@/hooks/use-resource';
import { Badge, Button, Card, Choice, Empty, Feedback, Field, Nav, Notice, Page, styles } from '@/components/ui';
import { applicationsApi, resumesApi } from '@/services/api';
import { InterviewPreparation } from '@/screens/preparation';
import {
  interviewsApi, progressLabels, roundStatusLabels, resultLabels, modeLabels, noteLabels,
  emptyRound, localInterviewDate, interviewISO, roundNeedsUpdate, nextInterview, utcDate,
  trackingFilters, matchesTracking, historyChanges, historyValue,
  type HiringProgress, type InterviewRound, type RoundInput, type TrackingFilter,
} from '@/services/interviews';

const options = <T extends Record<string, string>>(labels: T) => Object.entries(labels).map(([value, label]) => ({ value: value as keyof T & string, label }));

export function Interviews() {
  const resource = useResource(interviewsApi.list);
  const [filter, setFilter] = useState<TrackingFilter>('all');
  const [query, setQuery] = useState('');
  const visible = resource.data?.filter(item => matchesTracking(item, filter) && `${item.application.job?.company} ${item.application.job?.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Page title="Interviews & outcomes" subtitle="Track every round and what you learned." {...resource}>
    <Nav label="All applications" href="/applications" />
    <Field label="Search company or role" value={query} onChangeText={setQuery} />
    <Choice label="Show" value={filter} options={options(trackingFilters)} onChange={setFilter} />
    {visible?.map(item => {
      const next = nextInterview(item.rounds);
      return <Card key={item.application.id} title={item.application.job?.title}>
        <Text style={styles.muted}>{item.application.job?.company}</Text>
        <Text style={styles.text}>{progressLabels[item.application.hiring_progress]}</Text>
        <Text style={styles.muted}>{item.rounds.length} interview round(s)</Text>
        {item.rounds.some(r => roundNeedsUpdate(r)) && <Notice text="Needs update: record what happened at your past appointment." />}
        <Text style={styles.text}>{next ? `${next.name} · ${utcDate(next.scheduled_at!).toLocaleString()}` : 'No upcoming interview'}</Text>
        <Text style={styles.muted}>Latest: {item.history[0]?.description || 'Progress recorded'} · {utcDate(item.application.updated_at).toLocaleDateString()}</Text>
        <Nav label="View / update interviews →" href={`/interviews/${item.application.id}`} />
      </Card>;
    })}
    {visible && !visible.length && <Empty text="No matching interviews. Open a sent application or one submitted elsewhere, then update progress or add a round." />}
  </Page>;
}

export function InterviewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(async () => {
    const [app, resumes] = await Promise.all([applicationsApi.get(Number(id)), resumesApi.list()]);
    return { app, resumes };
  }, id);
  return <Page title={resource.data?.app.job?.title || 'Interview tracking'} subtitle={resource.data?.app.job?.company} back {...resource}>
    {resource.data && <>
      <Nav label="Open original application" href={`/applications/${id}`} />
      <InterviewTrackingPanel key={id} applicationId={Number(id)} />
      <InterviewPreparation application={resource.data.app} resumes={resource.data.resumes} />
    </>}
  </Page>;
}

export function InterviewTrackingPanel({ applicationId }: { applicationId: number }) {
  const [progress, setProgress] = useState<HiringProgress>('awaiting_response');
  const resource = useResource(async () => {
    const data = await interviewsApi.get(applicationId);
    setProgress(data.application.hiring_progress);
    return data;
  }, applicationId);
  const action = useAction();
  const [editor, setEditor] = useState<{ round?: InterviewRound }>();
  const [history, setHistory] = useState(false);
  const data = resource.data;
  return <Card title="Interviews & outcomes">
    {resource.loading && <Text style={styles.muted}>Loading interview tracking…</Text>}
    {!!resource.error && <><Notice text={resource.error} error /><Button label="Retry" onPress={() => { void resource.refresh(); }} /></>}
    <Feedback {...action} />
    {data && <>
      <Choice label="Hiring progress" value={progress} options={options(progressLabels)} onChange={setProgress} disabled={action.busy} />
      <Button label="Update progress" disabled={action.busy || progress === data.application.hiring_progress} onPress={() => {
        void action.run(async () => { resource.setData(await interviewsApi.progress(applicationId, progress)); }, 'Hiring progress saved.');
      }} />
      {!data.rounds.length && <Text style={styles.muted}>No interview rounds yet. Add one, or record the hiring outcome directly.</Text>}
      {data.rounds.map(round => <Card key={round.id} title={round.name}>
        <Badge value={round.status} />
        <Text style={styles.muted}>{modeLabels[round.mode]}{round.status === 'completed' ? ` · ${resultLabels[round.result]}` : ''}</Text>
        {roundNeedsUpdate(round) && <Notice text="Needs update: record whether you attended, missed it, or rescheduled." />}
        {!!round.scheduled_at && <Text style={styles.text}>{utcDate(round.scheduled_at).toLocaleString()}</Text>}
        {!!round.location && <Text selectable style={styles.text}>Meeting link / location: {round.location}</Text>}
        {!!round.contact && <Text style={styles.text}>Contact: {round.contact}</Text>}
        {options(noteLabels).filter(({ value }) => round[value]).map(({ value, label }) => <View key={value}><Text style={styles.label}>{label}</Text><Text selectable style={styles.text}>{round[value]}</Text></View>)}
        <Button secondary label="Edit / reschedule" disabled={!!editor || action.busy} onPress={() => setEditor({ round })} />
      </Card>)}
      {!editor && <Button label="Add interview round +" disabled={action.busy} onPress={() => setEditor({})} />}
      {editor && <RoundEditor key={editor.round?.id || 'new'} round={editor.round} applicationId={applicationId} onCancel={() => setEditor(undefined)} onSave={value => { resource.setData(value); setProgress(value.application.hiring_progress); setEditor(undefined); }} />}
      {!!data.history.length && <>
        <Button secondary label={`${history ? 'Hide' : 'Show'} change history (${data.history.length})`} onPress={() => setHistory(!history)} />
        {history && data.history.map(change => <Card key={change.id} title={change.description}>
          <Text style={styles.muted}>{utcDate(change.created_at).toLocaleString()}</Text>
          {historyChanges(change).map(key => <View key={key}><Text style={styles.label}>{({ ...noteLabels, progress: 'Hiring progress', scheduled_at: 'Date & time' } as Record<string, string>)[key] || key.replace(/_/g, ' ')}</Text>{key in change.before && <Text style={styles.muted}>Previously: {historyValue(key, change.before[key])}</Text>}<Text selectable style={styles.text}>{historyValue(key, change.after[key])}</Text></View>)}
        </Card>)}
      </>}
    </>}
  </Card>;
}

function RoundEditor({ round, applicationId, onSave, onCancel }: {
  round?: InterviewRound; applicationId: number;
  onSave: (value: Awaited<ReturnType<typeof interviewsApi.get>>) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<RoundInput>(round ? { ...round } : { ...emptyRound });
  const [date, setDate] = useState(localInterviewDate(round?.scheduled_at || null));
  const action = useAction();
  const patch = <K extends keyof RoundInput>(key: K, value: RoundInput[K]) => setForm(old => ({ ...old, [key]: value }));
  return <Card title={round ? 'Update interview round' : 'Add interview round'}>
    <Field label="Round name *" value={form.name} onChangeText={value => patch('name', value)} maxLength={200} editable={!action.busy} />
    <Field label={`Date & time (${Intl.DateTimeFormat().resolvedOptions().timeZone}), optional unless scheduled`} placeholder="YYYY-MM-DDTHH:mm" value={date} onChangeText={setDate} autoCapitalize="none" editable={!action.busy} />
    <Choice label="Round status" value={form.status} options={options(roundStatusLabels)} onChange={status => setForm(old => ({ ...old, status, result: status === 'completed' ? old.result : 'awaiting_result' }))} disabled={action.busy} />
    <Choice label="Round result" value={form.result} options={options(resultLabels)} onChange={value => patch('result', value)} disabled={form.status !== 'completed' || action.busy} />
    <Choice label="Interview mode" value={form.mode} options={options(modeLabels)} onChange={value => patch('mode', value)} disabled={action.busy} />
    <Field label="Meeting link / location" value={form.location} onChangeText={value => patch('location', value)} maxLength={2000} editable={!action.busy} />
    <Field label="Contact details" value={form.contact} onChangeText={value => patch('contact', value)} maxLength={500} editable={!action.busy} />
    {options(noteLabels).map(({ value, label }) => <Field key={value} label={label} value={form[value]} multiline maxLength={50000} editable={!action.busy} onChangeText={text => patch(value, text)} />)}
    <Feedback {...action} />
    <Button label={action.busy ? 'Saving…' : 'Save round'} disabled={action.busy || !form.name.trim()} onPress={() => {
      void action.run(async () => { onSave(await interviewsApi.saveRound(applicationId, { ...form, scheduled_at: interviewISO(date) }, round?.id)); });
    }} />
    <Button secondary label="Cancel editing" disabled={action.busy} onPress={onCancel} />
  </Card>;
}
