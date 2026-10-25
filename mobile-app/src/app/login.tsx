import { useState } from "react";
import { Text, View } from "react-native";
import { useSession } from "@/providers/session";
import { useAction } from "@/hooks/use-resource";
import { Button, Card, Feedback, Field, Page, styles } from "@/components/ui";
export default function Login() {
  const { signIn } = useSession();
  const action = useAction();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Page
      title={register ? "Start your next chapter." : "Welcome back."}
      subtitle="Thoughtful applications. New opportunities."
    >
      <View
        style={[
          styles.card,
          { backgroundColor: "#edf4ee", paddingVertical: 30 },
        ]}
      >
        <Text style={styles.brand}>ApplyPilot.</Text>
        <Text style={styles.h2}>
          Your experience deserves{"\n"}the right opportunity.
        </Text>
        <Text style={styles.muted}>
          Find your fit, prepare an application, and keep your job search
          moving.
        </Text>
      </View>
      <Card
        title={register ? "Create your account" : "Sign in to your workspace"}
      >
        <Field
          label="Email address"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          editable={!action.busy}
        />
        <Field
          label="Password"
          secureTextEntry
          autoComplete={register ? "new-password" : "current-password"}
          value={password}
          onChangeText={setPassword}
          editable={!action.busy}
        />
        <Feedback {...action} />
        <Button
          label={
            action.busy
              ? "Connecting…"
              : register
                ? "Create account"
                : "Sign in"
          }
          disabled={action.busy || !email.trim() || !password}
          onPress={() => {
            void action.run(() => signIn(email, password, register));
          }}
        />
        <Button
          label={
            register
              ? "Already have an account? Sign in"
              : "New here? Create an account"
          }
          secondary
          disabled={action.busy}
          onPress={() => setRegister(!register)}
        />
      </Card>
    </Page>
  );
}
