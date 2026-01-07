import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <h1 className="text-lg font-semibold">
            Checkout
          </h1>

          <p className="text-sm text-secondary">
            Confirme sua compra para continuar.
          </p>

          <Link href="/order">
            <Button>
              Pagar
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
