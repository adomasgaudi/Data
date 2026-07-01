import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { sampleSets } from "@/lib/csv";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Data-health summary + a Radix Dialog demo from the design system. */
export function DataHealth() {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const exercises = new Set<string>();
    for (const r of sampleSets) {
      if (r.exercise_name) exercises.add(r.exercise_name);
    }
    return { total: sampleSets.length, distinct: exercises.size };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nav_health")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-8">
          <div>
            <div className="font-semibold text-2xl">{stats.total}</div>
            <div className="text-muted-foreground text-sm">{t("total_sets")}</div>
          </div>
          <div>
            <div className="font-semibold text-2xl">{stats.distinct}</div>
            <div className="text-muted-foreground text-sm">{t("distinct_exercises")}</div>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="self-start">
              {t("about")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>{t("about")}</DialogTitle>
            <p className="text-muted-foreground text-sm">{t("about_body")}</p>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
