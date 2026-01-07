import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ServicePage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold">
            Serviço em andamento
          </h1>

          <Badge variant="in_progress">
            Em andamento
          </Badge>

          <p className="text-sm text-secondary">
            Um prestador já foi atribuído ao seu serviço.
          </p>

          <Link href="/review">
            <Button>
              Avaliar serviço
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
