import { redirect } from "next/navigation";

export default function PersonRolesPage() {
  redirect(
    "/people?create=success&message=Vinculos%20de%20cargo%20agora%20sao%20feitos%20no%20modulo%20Pessoas.",
  );
}
