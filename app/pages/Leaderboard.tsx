import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sampleSets } from "@/lib/csv";
import { useFlag } from "@/lib/flags";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Top added-weight sets from the bundled log — a small demo of the PapaParse
 * data flowing through React + the design system. Not the full scoring model. */
export function Leaderboard() {
  const { t } = useTranslation();
  const experimental = useFlag("showExperimentalCharts");

  const rows = useMemo(() => {
    return sampleSets
      .map((r) => ({
        username: r.username,
        exercise: r.exercise_name,
        weight: Number.parseFloat(r.weight),
        reps: Number.parseInt(r.reps, 10),
      }))
      .filter((r) => r.username && Number.isFinite(r.weight))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nav_leaderboard")}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b text-left text-muted-foreground">
              <th className="py-2">{t("col_athlete")}</th>
              <th className="py-2">{t("col_exercise")}</th>
              <th className="py-2 text-right">{t("col_weight")}</th>
              <th className="py-2 text-right">{t("col_reps")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.username}-${r.exercise}-${i}`} className="border-border/50 border-b">
                <td className="py-2">{r.username}</td>
                <td className="py-2">{r.exercise}</td>
                <td className="py-2 text-right">{r.weight}</td>
                <td className="py-2 text-right">{r.reps || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {experimental && (
          <p className="mt-3 text-muted-foreground text-xs">Experimental charts flag is ON.</p>
        )}
      </CardContent>
    </Card>
  );
}
