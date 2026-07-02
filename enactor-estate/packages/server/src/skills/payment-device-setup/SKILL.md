---
name: payment-device-setup
description: Orchestrates a multi-step workflow to configure a payment device (e.g., MPOC, Verifone) and links it to a POS terminal.
---

# Payment Device Setup Workflow

You are responsible for executing the end-to-end setup of Payment Devices (such as MPOC or Verifone terminals) in Enactor Estate Manager. This is a complex multi-step workflow that requires generating multiple linked XML entities and bundling them into a ZIP file.

## General Workflow

Follow these exact steps in order:

1. **Collect Payment Device Information:**
   Ask the user for the following required information if they did not provide it upfront:
   - Payment Device ID and Name.
   - Device Type (e.g., MPOC, Verifone).
   - Target POS Terminal ID (or the `deviceId` it's registered to).
   - Unique App/Hardware Serial Number.

   **CRITICAL UX GUIDELINES:**
   - Do not just ask "What is the device type?" without context. Tell the user _why_ you are asking (e.g., "I need to know the device type so I can determine which existing `iccReaderType` and `iccReaderConfiguration` to use from your Estate Manager").
   - When asking the user for details, you MUST explicitly clarify if you are asking for **existing** details or details for a **new** creation.
     - Example (Existing): _"Please provide the exact Device ID of the existing device you want to configure."_
     - Example (New): _"We are going to create a brand new POS Terminal. Please provide a new Terminal Number you would like to use."_
   - Never leave the user guessing whether they need to invent a new ID or look up an existing one.

2. **Verify POS Terminal & Extract Location:**
   A POS terminal is 1:1 with a Device. When the user provides a target POS Terminal/Device ID (e.g., `pos1@0001.enactor`), you must verify the terminal exists and find its Location ID.
   - First, use `fetch_estate_config` with `entityType: "posTerminal"`, `filterField: "DeviceId"`, and `filterValue` set to the provided ID to verify the terminal exists. (If it returns 204 No Content, stop and inform the user).
   - Second, use `fetch_estate_config` with `entityType: "device"`, `filterField: "DeviceId"`, and `filterValue` set to the provided ID. (Do not use `summaryOnly: true`).
   - Extract the `<retail:locationId>` from the returned Device XML so you can use it later in Step 5 when generating the Payment Device.

3. **Resolve ICC Reader Type & Configuration Data:**
   The user maintains static instances of `IccReaderType` and `IccReaderConfiguration` in the system.
   - If the Device Type is **MPOC**, you MUST use the following hardcoded static IDs:
     - `iccReaderType` / `iccReaderTypeId`: `ENACTOR_MPOC`
     - `iccReaderConfigurationId` / `iccReaderConfigId`: `MPOC_ICC_CONFIG`
   - For any other device type:
     1. Use `fetch_estate_config` with `entityType: "iccReaderType"` and `summaryOnly: true` to retrieve a compact list of all available ICC Reader Types.
     2. Present the list to the user (showing the `iccReaderTypeId`, `description`, and `manufacturerName` for each) and ask them to select the appropriate one.
     3. Once the type is selected, use `fetch_estate_config` with `entityType: "iccReaderConfiguration"` and `summaryOnly: true` to retrieve a compact list of all available ICC Reader Configurations.
     4. Present the list to the user (showing the `iccReaderConfigurationId`, `description`, and `iccReaderTypeKey` for each) and ask them to select the appropriate one. Let them know they can match the configuration to their selected type based on the `iccReaderTypeKey`.
     5. If either fetch returns no results (204), inform the user that they must create the missing entity manually in Estate Manager before proceeding.

4. **Collect Payment Device Host Information:**
   Ask the user for the details required to create or set up the Payment Device Host (new or existing):
   - **Payment Device Host ID:** Must match the `PdcId` value in the PDC configuration file (allows a single TMS instance to manage multiple PDCs).
   - **Device Key:** Links the Host to a Device that specifies location properties. _IMPORTANT:_ The Device in question must have its Device Type set to `PAYMENT_SERVICE`.
   - **Proxy Address:** The address where the PDC will listen to client connections. Must be TCP/IP: either `tcp:<IP address>:<port>` or `tcp:<port>`.
   - **Service Type:** Must be set to `ICC Reader Service`.

5. **Fetch and Generate Templates (Step-by-Step):**
   To prevent memory overload, fetch and generate the templates one by one in memory:
   - Use `get_template` for `icc-reader`.
   - Use `get_template` for `payment-device-host`.
   - Use `get_template` for `payment-device`.

   Apply the following relational logic when generating:
   - `iccReaderTypeId` (in ICC Reader) and `iccReaderType` (in Payment Device) must be filled using the static Type data resolved in Step 3.
   - `iccReaderConfigId` (in Payment Device) must be filled using the static Configuration ID resolved in Step 3.
   - `deviceId` (in ICC Reader) should match the POS Terminal's deviceId.
   - `deviceId` (in Payment Device Host) must be the Device Key collected in Step 4.
   - `paymentDeviceId` (in Payment Device Host) must be the Payment Device ID collected in Step 1.
   - `locationId` MUST match the POS Terminal.
   - `iccReaderAddress` must use the Proxy Address details.
   - `serialNumber` (in the ICC Reader) must use the user-provided Serial Number.

6. **Deploy via ZIP:**
   Bundle the generated XML files (`icc-reader`, `payment-device-host`, `payment-device`) and deploy them simultaneously using the `import_estate_config_zip` tool.

7. **Update POS Terminal:**
   Use `fetch_estate_config` with `entityType: "posTerminal"`, `filterField: "DeviceId"`, and `filterValue` set to the POS Terminal's deviceId to retrieve the existing POS Terminal XML.
   - **If the XML is returned:** Modify the following three fields in the retrieved XML, keeping everything else untouched:
     - `<retail:paymentServiceType>` to `Enactor`.
     - `<retail:paymentServiceAddress>` to the Proxy Address.
     - `<retail:paymentDeviceHostId>` to the Payment Device Host ID collected in Step 4.
       Then re-import the modified XML using `import_estate_config`.
   - **If no entity is found (204):** Use `get_template` for `pos-terminal` to create a new terminal instead, filling in the three payment fields above along with the standard placeholders.

8. **Completion:**
   Inform the user that the payment device has been successfully configured and linked to the POS terminal.
