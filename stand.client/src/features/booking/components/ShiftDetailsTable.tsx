import { Table, TableBody, TableCell, TableRow } from '@mui/material';
import type { MyShiftDto } from '../../../api/types';
import { formatDate } from '../../../utils/date';
import { bookingCopy } from '../bookingCopy';

type ShiftDetails = Pick<MyShiftDto, 'date' | 'startTime' | 'endTime' | 'locationName' | 'locationAddress'>;

export default function ShiftDetailsTable({ shift }: { shift: ShiftDetails }) {
    const rows = [
        ['Дата', formatDate(shift.date)],
        ['Час', `${shift.startTime}–${shift.endTime}`],
        ['Локація', [shift.locationName, shift.locationAddress].filter(Boolean).join(', ')],
    ];

    return (
        <Table size="small" aria-label={bookingCopy.shiftDetails} sx={{ tableLayout: 'fixed', '& .MuiTableCell-root': { border: 0, px: 0, py: 0.5, verticalAlign: 'top' } }}>
            <TableBody>
                {rows.map(([label, value]) => (
                    <TableRow key={label}>
                        <TableCell component="th" scope="row" sx={{ width: 76, fontWeight: 700 }}>{label}</TableCell>
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>{value}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
