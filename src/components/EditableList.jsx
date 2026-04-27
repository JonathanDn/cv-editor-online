import Editable from "./Editable.jsx";

export default function EditableList({
                                         items,
                                         onChange,
                                         placeholder = "New item"
                                     }) {
    const addItem = () => onChange([...items, placeholder]);

    const removeItem = (index) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="editable-list">
            {items.map((item, index) => (
                <div className="editable-list-item" key={index}>
                    <span className="bullet">•</span>

                    <Editable
                        value={item}
                        onChange={(value) =>
                            onChange(items.map((entry, i) => (i === index ? value : entry)))
                        }
                        className="list-text"
                        multiline
                    />

                    <button
                        className="screen-only mini-btn"
                        onClick={() => removeItem(index)}
                        title="Remove item"
                    >
                        ×
                    </button>
                </div>
            ))}

            <button className="screen-only add-btn" onClick={addItem}>
                + Add item
            </button>
        </div>
    );
}