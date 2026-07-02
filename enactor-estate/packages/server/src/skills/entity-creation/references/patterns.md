# Entity Patterns

Each section below describes a specific entity type: what fields are required,
any validation rules, prerequisites, and where to find the XML template.

---

## pos-terminal

**Description:** A POS terminal configuration tied to a specific device.

**Prerequisites:**

- The device referenced by the Device ID must already exist in Estate Manager.
- Use the `check_device` tool to verify. If the device does not exist, create it
  first using the `device` entity instructions below, then return here.

**Required Fields:**
| Field | Example | Notes |
|---|---|---|
| deviceId | `aut.MPOS1@0001.enactor` | Must reference an existing device |
| description | `AUT MPOS 1 @ Enactor Store` | Human-readable terminal name |
| terminalNumber | `211` | Must be unique across all terminals |

**Filename convention:** `terminal_{{terminalNumber}}.xml`

**To get the XML template:** call `get_template` with `entityName: "pos-terminal"`

---

## device

**Description:** A hardware device registration that POS terminals are attached to.

**Prerequisites:** None. Devices can be created independently.

**Required Fields:**
| Field | Example | Notes |
|---|---|---|
| deviceId | `mypos@0001.enactor` | Unique identifier for the device |
| deviceName | `My POS @ Hertford` | Human-readable name |
| hostName | `localhost` | Machine hostname |
| locationId | `0001` | Auto-extract from deviceId if possible |
| deviceType | `POS` | Defaults to POS; alternatives: MOBILE_POS, BACK_OFFICE, HHT |

**Auto-extraction rule for locationId:**
Pattern: `{prefix}@{locationId}.enactor` → extract the part between `@` and `.enactor`.
Example: `mypos@0001.enactor` → locationId = `0001`.
If the Device ID does not follow this pattern, ask the user explicitly.

**Filename convention:** `device_{{deviceId}}.xml`

**To get the XML template:** call `get_template` with `entityName: "device"`

---

## payment-device

**Description:** A Payment Device configuration representing a physical PED (e.g., Verifone, MPOC).

**Prerequisites:** None.

**Required Fields:**
| Field | Example | Notes |
|---|---|---|
| paymentDeviceId | `MPOC_Device` | Unique identifier for the payment device |
| locationId | `0001` | Must match the POS Terminal location |
| iccReaderType | `ENACTOR_MPOC` | Varies by device type (e.g. Dione, ENACTOR_MPOC) |
| iccReaderAddress | `tcp:10.0.0.5:16108` | Varies by device type |
| iccReaderConfigId | `MPOC_ICC_CONFIG` | Varies by device type |

**Filename convention:** `payment_device_{{paymentDeviceId}}.xml`

**To get the XML template:** call `get_template` with `entityName: "payment-device"`

---

## payment-device-host

**Description:** The host routing configuration that sits between the POS Terminal and the Payment Device.

**Prerequisites:**

- The `payment-device` must be created first.
- The base `device` (e.g., `TestDevice@0001.enactor`) must exist.

**Required Fields:**
| Field | Example | Notes |
|---|---|---|
| pdhId | `MPOC_PDH` | Unique identifier for the host |
| deviceId | `PaymentTest@0001.enactor` | Must reference an existing base device |
| proxyAddress | `tcp:localhost:7777` | The address the PDC listens on |
| paymentDeviceId | `MPOC_Device` | Must match the `paymentDeviceId` of the Payment Device |

**Filename convention:** `payment_device_host_{{pdhId}}.xml`

**To get the XML template:** call `get_template` with `entityName: "payment-device-host"`

---

## icc-reader

**Description:** Represents the physical or software-based ICC Reader hardware/app, identified by its serial number.

**Prerequisites:**

- The `iccReaderType` must exist.

**Required Fields:**
| Field | Example | Notes |
|---|---|---|
| iccReaderTypeId | `ENACTOR_MPOC` | Varies by device type (e.g. Dione, ENACTOR_MPOC) |
| deviceId | `pos1@0001.enactor` | Optional: The device this reader is attached to |
| serialNumber | `123456` | MUST BE PROMPTED FOR: The unique physical or app serial number |
| locationId | `0001` | Must match the POS Terminal location |
| dateDefined | `2026-06-24T00:00:00Z` | The current date in ISO format |

**Filename convention:** `icc_reader_{{serialNumber}}.xml`

**To get the XML template:** call `get_template` with `entityName: "icc-reader"`
