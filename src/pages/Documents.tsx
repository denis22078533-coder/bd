import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, setS3Config } from "@/lib/api";
import { loadPreview } from "@/components/documents/docTypes";
import DocList from "@/components/documents/DocList";
import DocDetail from "@/components/documents/DocDetail";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);

  const loadDocs = async () => {
    try {
      const res = await api.documents.list();
      const withPreviews = res.documents.map((doc) => ({
        ...doc,
        previewUrl: loadPreview(doc.id) || doc.s3_url || null,
      }));
      setDocs(withPreviews);
      if (withPreviews.length > 0) setSelected(withPreviews[0]);
    } catch {
      console.error("Failed to load documents");
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  return (
    <div className="documents-container">
<DocList
  docs={docs}
  loading={false}
  selected={selected}
  dragging={false}
  inputRef={null}
  onSelect={setSelected}
  onDelete={() => {}}
  onDragOver={() => {}}
  onDragLeave={() => {}}
  onDrop={() => {}}
  onFilesChange={() => {}}
/>
{selected && (
  <DocDetail
    selected={selected}
    selDone={true}
    editingCategory={false}
    savingCategory={false}
    customCategories={[]}
    onRecognizeAgain={() => {}}
    onShare={() => {}}
    onDownload={() => {}}
    onReupload={() => {}}
    onDelete={() => {}}
    onFieldUpdate={() => {}}
    onCategoryChange={() => {}}
    mobileView={"list"}
    newCatInline={""}
    addingCatInline={false}
    reuploadRef={null}
    onSetEditingCategory={() => {}}
    onSetAddingCatInline={() => {}}
    onSetNewCatInline={() => {}}
    onSetCustomCategories={() => {}}
    onOpenCreateTx={() => {}}
    onSaveCustomCategory={() => {}}
  />
)}
    </div>
  );
}