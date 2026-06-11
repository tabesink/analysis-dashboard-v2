import { redirect } from 'next/navigation';

/**
 * Legacy full-page Edit Metadata route — hidden pending removal.
 * Metadata editing is available via the pencil icon dialog on the Database table.
 */
export default function EditMetadataPage() {
  redirect('/database');
}
