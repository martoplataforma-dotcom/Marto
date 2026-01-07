import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function OrderPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold">
            Pedido criado
          </h1>

          <Badge variant="paid">
            Pago
          </Badge>

          <p className="text-sm text-secondary">
            Seu pedido foi confirmado e o serviço será iniciado.
          </p>

          <Link href="/service">
            <Button>
              Acompanhar serviço
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
