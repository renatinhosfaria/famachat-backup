import { Cliente } from "@/hooks/use-dashboard-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/utils";

type RecentClientesProps = {
  clientes: Cliente[];
};

export default function RecentClientes({ clientes }: RecentClientesProps) {
  // Se não houver clientes, não exiba nada
  if (!clientes.length) return null;

  return (
    <Card className="mb-4 xxs:mb-6">
      <CardHeader className="p-3 xxs:p-6">
        <CardTitle className="text-sm md:text-base lg:text-lg xl:text-lg 2xl:text-lg">Clientes Recentes</CardTitle>
        <CardDescription className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-sm">
          Últimos clientes capturados no período
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 xxs:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">Nome</TableHead>
                <TableHead className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">Contato</TableHead>
                <TableHead className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">Data</TableHead>
                <TableHead className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">{cliente.fullName}</TableCell>
                  <TableCell className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">{cliente.phone}</TableCell>
                  <TableCell className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base">{cliente.date}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${getStatusColor(cliente.status).bg} text-xs md:text-sm lg:text-xs xl:text-xs 2xl:text-sm`}
                    >
                      {cliente.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}