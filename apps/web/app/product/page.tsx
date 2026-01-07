import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProductPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold">
            Produto Exemplo
          </h1>

          <p className="text-sm text-secondary">
            Este produto inclui serviço profissional.
          </p>

          <p className="text-base font-medium">
            R$ 199,00
          </p>

          <Link href="/checkout">
            <Button>
              Comprar
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
