import { useEffect, useState } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase, Element, FieldValue, SectionDefinition } from "../../../domain/model/types.js";
import { FieldInputs } from "./FieldInputs.js";
import { sortAlpha } from "../sortAlpha.js";
import { guessElementLabel } from "../../../domain/labels.js";
import { useUILanguage } from "../UILanguageContext.js";

export function ElementCard({
  appStore,
  db,
  section,
  element,
}: {
  appStore: AppStore;
  db: AppDatabase;
  section: SectionDefinition;
  element: Element;
}) {
  const { t } = useUILanguage();
  const variants = sortAlpha(
    element.variantIds
      .map((id) => db.variants.find((v) => v.id === id))
      .filter((v): v is NonNullable<typeof v> => Boolean(v)),
    (v) => v.name
  );
  const activeVariant = variants.find((v) => v.id === element.defaultVariantId) ?? variants[0] ?? null;

  // Colapsado por defecto (petición explícita: "que no ocupen tanto") —
  // igual que CvItemEditPanel en el editor de CV, salvo que aquí el estado
  // vive en cada ElementCard por separado (no hace falta forzar que solo
  // uno esté abierto a la vez en esta pantalla).
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, FieldValue>>(activeVariant?.fields ?? {});
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1500);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  if (!activeVariant) return null; // un elemento sin variantes es un estado inválido, no debería ocurrir
  const variant = activeVariant; // fijamos el tipo no-nulo para las funciones anidadas de abajo

  function handleVariantSwitch(variantId: string) {
    const target = variants.find((v) => v.id === variantId);
    if (!target) return;
    appStore.setDefaultVariant(element.id, variantId);
    setDraft(target.fields);
  }

  function handleSave() {
    appStore.saveVariant(variant.id, draft);
    setJustSaved(true);
  }

  function handleSaveAsVariant() {
    const name = window.prompt(t("newVariantPrompt"), `${variant.name}${t("variantCopySuffix")}`);
    if (!name) return;
    const { variantId } = appStore.forkVariant(variant.id, name, draft);
    appStore.setDefaultVariant(element.id, variantId);
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
   * Petición explícita del usuario: el nombre que identifica a este
   * elemento en listas/selectores (p.ej. al añadirlo a un CV) se quedaba
   * "pegado" al primer nombre que tuvo, porque hasta ahora solo se
   * adivinaba a partir del campo de título de la variante por defecto —
   * esto permite fijar uno explícito, independiente de esos campos. Dejar
   * el campo vacío vuelve a la adivinanza automática de siempre (no es un
   * error, a diferencia de renombrar una variante).
   */
  function handleRenameElement() {
    const current = guessElementLabel(element, db);
    const name = window.prompt(
      t("renameElementPrompt"),
      current
    );
    if (name === null) return;
    appStore.renameElement(element.id, name);
  }

  function handleDelete() {
    // §15 del contexto: avisar ANTES de borrar si algún CV usa esto. La UI
    // completa de 3 opciones ("quitar del CV" / "quitar y enviar a
    // papelera" / "cancelar") llega en la Fase 4, cuando exista UI de CVs;
    // por ahora al menos no se borra en silencio.
    const referencedByCvVersionIds = appStore.findReferences("element", element.id);
    if (referencedByCvVersionIds.length > 0) {
      const proceed = window.confirm(
        `${t("referencedByPrefix")}${referencedByCvVersionIds.length}${t("referencedBySuffix")}. ${t("trashElementWithReferences")}`
      );
      if (!proceed) return;
    }
    appStore.trashElement(element.id);
  }

  /**
   * A diferencia de `handleDelete` (que envía el ELEMENTO ENTERO —todas sus
   * variantes— a la papelera de una sola vez), esto borra solo la variante
   * que se está viendo ahora mismo, dejando las demás intactas. Si es la
   * única variante que le queda al elemento, `moveVariantToTrash` (dominio,
   * ver trash.ts) hace cascada y también envía el elemento a la papelera
   * completo — se avisa de eso explícitamente antes de confirmar, porque
   * si no el resultado sería indistinguible de "Eliminar elemento".
   */
  function handleDeleteVariant() {
    const otherVariants = variants.filter((v) => v.id !== variant.id);
    const referencedByCvVersionIds = appStore.findReferences("variant", variant.id);
    let message =
      otherVariants.length === 0
        ? `"${variant.name}" es la única variante de este elemento: eliminarla enviará también el ` +
          "elemento completo a la papelera."
        : `¿Enviar la variante "${variant.name}" a la papelera?`;
    if (referencedByCvVersionIds.length > 0) {
      message +=
        ` Se usa en ${referencedByCvVersionIds.length} versión(es) de CV: quedarán con una ` +
        "referencia rota hasta que la restaures.";
    }
    if (!window.confirm(message)) return;
    appStore.trashVariant(variant.id);
    if (otherVariants.length > 0) {
      handleVariantSwitch(otherVariants[0]!.id);
    }
  }

  return (
    <article className="element-card">
      <header className="element-card__header">
        <span className="element-card__label" title={t("elementLabelTitle")}>
          {guessElementLabel(element, db)}
        </span>
        {isEditing && (
          <>
            <button className="link-button" onClick={handleRenameElement}>
              {t("renameElement")}
            </button>
            <select value={variant.id} onChange={(e) => handleVariantSwitch(e.target.value)}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button className="link-button" onClick={handleRename}>
              {t("rename")}
            </button>
            <button className="link-button link-button--danger" onClick={handleDeleteVariant}>
              {t("deleteVariant")}
            </button>
            <button className="link-button link-button--danger" onClick={handleDelete}>
              {t("deleteFullElement")}
            </button>
          </>
        )}
        <button className="secondary-button element-card__toggle" onClick={() => setIsEditing((v) => !v)}>
          {isEditing ? t("close") : t("edit")}
        </button>
      </header>

      {isEditing && (
        <>
          <FieldInputs fieldSchema={section.fieldSchema} values={draft} onChange={setDraft} />

          <div className="element-card__actions">
            <button className="primary-button" onClick={handleSave}>
              {t("save")}
            </button>
            {justSaved && <span className="cv-item-edit-panel__saved">{t("saved")}</span>}
            <button className="secondary-button" onClick={handleSaveAsVariant}>
              {t("saveAsVariant")}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
