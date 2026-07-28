import { ADDRESS_LABELS } from '../../domain/address';

/**
 * Editable address fields after location has been resolved.
 * House/flat, line 2, landmark, and label are the primary editables.
 */
export function AddressFormFields({ form, onChange, showContact = true }) {
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    onChange({
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    });
  }

  return (
    <div className="address-form-fields">
      {form.formattedAddress && (
        <div className="address-detected">
          <span className="section-label">DETECTED ADDRESS</span>
          <p>{form.formattedAddress}</p>
          {form.latitude != null && form.longitude != null && (
            <p className="muted address-coords">
              Pin: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
              {form.accuracyM != null ? ` · GPS ±${form.accuracyM} m` : ''}
            </p>
          )}
          {form.accuracyWarning && (
            <p className="form-error" style={{ marginBottom: 0 }}>{form.accuracyWarning}</p>
          )}
        </div>
      )}

      <label className="form-label">
        Label
        <select name="label" className="form-input" value={form.label} onChange={handleChange}>
          {ADDRESS_LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {showContact && (
        <>
          <label className="form-label">
            Full name
            <input
              name="fullName"
              className="form-input"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </label>

          <label className="form-label">
            Phone
            <input
              name="phone"
              className="form-input"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </label>
        </>
      )}

      <label className="form-label">
        House / flat number
        <input
          name="line1"
          className="form-input"
          value={form.line1}
          onChange={handleChange}
          placeholder="e.g. Flat 402, Wing B"
          required
        />
      </label>

      <label className="form-label">
        Address line 2
        <input
          name="line2"
          className="form-input"
          value={form.line2}
          onChange={handleChange}
          placeholder="Street / area"
        />
      </label>

      <label className="form-label">
        Landmark
        <input
          name="landmark"
          className="form-input"
          value={form.landmark}
          onChange={handleChange}
          placeholder="Near metro / park"
        />
      </label>

      <div className="form-row">
        <label className="form-label">
          City
          <input
            name="city"
            className="form-input"
            value={form.city}
            onChange={handleChange}
            required
          />
        </label>
        <label className="form-label">
          State
          <input
            name="state"
            className="form-input"
            value={form.state}
            onChange={handleChange}
            required
          />
        </label>
      </div>

      <label className="form-label">
        Pincode
        <input
          name="pincode"
          className="form-input"
          value={form.pincode}
          onChange={handleChange}
          required
          maxLength={6}
        />
      </label>

      <label className="form-check">
        <input
          type="checkbox"
          name="isDefault"
          checked={form.isDefault}
          onChange={handleChange}
        />
        Set as default
      </label>
    </div>
  );
}
