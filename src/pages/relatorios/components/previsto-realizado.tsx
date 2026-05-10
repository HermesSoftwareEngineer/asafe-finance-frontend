import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { relatoriosApi } from '../../../lib/api'
import { formatCurrency } from '../../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../components/ui/table'

interface PrevistoRow { categoria: { id: number; nome: string }; previsto: number; realizado: number; diferenca: number; percentual: number }

interface Props {
  dataInicio: string;
  dataFim: string;
  contaId?: string;
  enabled?: boolean;
}

export function PrevistoRealizado({ dataInicio, dataFim, contaId, enabled = true }: Props) {
  const params = { data_inicio: dataInicio, data_fim: dataFim, conta_id: contaId ? Number(contaId) : undefined }

  const { data, isLoading } = useQuery<PrevistoRow[]>({
    queryKey: ['relatorios', 'previsto', params],
    queryFn: () => relatoriosApi.previstoRealizado(params),
    enabled,
  })

  if (isLoading && enabled) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!enabled && !data) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Previsto vs Realizado</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!data?.length ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum dado encontrado.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">% Execução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.categoria.id}>
                  <TableCell className="font-medium">{row.categoria.nome}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.previsto)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.realizado)}</TableCell>
                  <TableCell className={`text-right ${row.diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(row.diferenca)}
                  </TableCell>
                  <TableCell className="text-right">{row.percentual.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
