import { useEffect, useState } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { FieldDefinition, FieldValue, Variant } from "../../../domain/model/types.js";
import { FieldInputs } from "./FieldInputs.js";
import { useUILanguage } from "../UILanguageContext.js";

/**
 * Panel de edición inline para el item de un CV concreto (§11 del
 * contexto: "Los elementos deben poder editarse... directamente desde la
 * representación visual del CV" — este es el equivalente para la lista de
 * contenido del editor de CV).
 *
 * A diferencia de ElementCard (que vive en la pantalla de "Base de datos"
 * y cambia el valor por defecto GLOBAL del elemento vía
 * `setDefaultVariant`), este panel es consciente de que la variante que
 * importa aquí es la que este CV en concreto tiene seleccionada para este
 * item (`item.variantId`), que puede no coincidir con el default global
 * del elemento — así que "Guardar como variante" cambia la selección SOLO
 * en este CV (vía `onVariantForked`), sin tocar el default de ningún otro
 * CV que use el mismo elemento.
 *
 * Se monta con `key={variant.id}` desde SectionComposer para que el
 * borrador se reinicie solo al cambiar de variante seleccionada, en vez de
 * tener que sincronizar el estado a mano.
 */
export function CvItemEditPanel({
  appStore,
  fieldSchema,
  variant,
  elementLabel,
  otherVariants,
  onVariantForked,
  onVariantDeleted,
  onDone,
}: {
  appStore: AppStore;
  fieldSchema: FieldDefinition[];
  variant: Variant;
  elementLabel: string;
  /** Las demás variantes de este mismo elemento (sin la actual) — solo se
   * usan para decidir el mensaje de aviso y a cuál caer al borrar la
   * actual, ver `handleDeleteVariant`. */
  otherVariants: Variant[];
  /** Se llama tras crear una variante nueva, para que el CV pase a usarla. */
  onVariantForked: (newVariantId: string) => void;
  /** Se llama tras enviar la variante actual a la papelera. Si quedaban
   * otras variantes del elemento, `fallbackVariantId` es a cuál debe pasar
   * este item del CV; si era la única (y por tanto se borró también el
   * elemento entero en cascada, ver trash.ts), es `null`. */
  onVariantDeleted: (fallbackVariantId: string | null) => void;
  onDone: () => void;
}) {
  const { t } = useUILanguage();
  const [draft, setDraft] = useState<Record<string, FieldValue>>(variant.fields);
  // Feedback transitorio: "Guardar" ya no cierra el panel (bug real
  // reportado: obligaba a volver a pulsar "Editar" para seguir tocando el
  // mismo item), así que hace falta alguna señal de que sí se guardó.
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1500);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  function handleSave() {
    appStore.saveVariant(variant.id, draft);
    setJustSaved(true);
  }

  function handleSaveAsVariant() {
    const name = window.prompt(t("newVariantPrompt"), `${variant.name}${t("variantCopySuffix")}`);
    if (!name) return;
    const { variantId } = appStore.forkVariant(variant.id, name, draft);
    onVariantForked(variantId);
  }

  /** Antes solo se podía poner un nombre a una variante al crearla ("Guardar como variante"). */
  function handleRename() {
    const name = window.prompt(t("renameVariantPrompt"), variant.name);
    if (!name) return;
    try {
      appStore.renameVariant(variant.id, name);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Borra SOLO esta variante (a diferencia de "Quitar"/"Eliminar" a nivel
   * de item en SectionComposer, que actúan sobre el elemento entero) —
   * antes solo se podía vaciar el elemento completo de una vez, perdiendo
   * también las demás variantes que no se querían tocar.
   */
  function handleDeleteVariant() {
    const referencedByCvVersionIds = appStore.findReferences("variant", variant.id);
    let message =
      otherVariants.length === 0
        ? `"${variant.name}${t("variantDeleteOnlyPrefix")}${elementLabel}${t("variantDeleteOnlySuffix")}`
        : `${t("variantDeleteConfirmPrefix")}${variant.name}${t("variantDeleteConfirmSuffix")}`;
    if (referencedByCvVersionIds.length > 0) {
      message += `${t("referencedByPrefix")}${referencedByCvVersionIds.length}${t("referencedByThisSuffix")}`;
    }
    if (!window.confirm(message)) return;
    appStore.trashVariant(variant.id);
    onVariantDeleted(otherVariants[0]?.id ?? null);
    onDone();
  }

  return (
    <div className="cv-item-edit-panel">
      <p className="cv-item-edit-panel__hint">
        {t("editingVariantPrefix")}{variant.name}{t("editingVariantMiddle")}{elementLabel}{t("editingVariantHint")}{" "}
        <button className="link-button cv-item-edit-panel__rename-button" onClick={handleRename}>
          {t("rename")}
        </button>{" "}
      </p>
      <FieldInputs fieldSchema={fieldSchema} values={draft} onChange={setDraft} />
      <div className="cv-item-edit-panel__actions">
        <button className="primary-button" onClick={handleSave}>
          {t("save")}
        </button>
        {justSaved && <span className="cv-item-edit-panel__saved">{t("saved")}</span>}
        <button className="secondary-button" onClick={handleSaveAsVariant}>
          {t("saveAsVariant")}
        </button>
        <button className="link-button link-button--danger" onClick={handleDeleteVariant}>
          {t("deleteVariant")}
        </button>
        <button className="link-button" onClick={onDone}>
          {t("close")}
        </button>
      </div>
    </div>
  );
}
