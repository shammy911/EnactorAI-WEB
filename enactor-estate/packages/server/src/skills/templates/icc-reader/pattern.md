# ICC Reader — XML Template

Use this template to generate the XML for a new ICC reader.
Replace all `{{ }}` placeholders with the values collected from the user.

```xml
<retail:iccReader xmlns:b4p="http://docs.oasis-open.org/ns/bpel4people/bpel4people/200803" xmlns:bpel11="http://schemas.xmlsoap.org/ws/2003/03/business-process/" xmlns:bpel20="http://docs.oasis-open.org/wsbpel/2.0/process/executable" xmlns:core="http://www.enactor.com/core" xmlns:hta="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/api/200803" xmlns:htd="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/200803" xmlns:htt="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/types/200803" xmlns:ns10="http://www.w3.org/2005/08/addressing" xmlns:ns11="http://www.w3.org/2003/05/soap-envelope" xmlns:ns13="http://www.enactor.com/retail/storedRetailTransaction/service" xmlns:ns14="https://finanzonline.bmf.gv.at/rkdb" xmlns:ns20="http://www.enactor.com/crm/customerLoyalty/service" xmlns:ns21="http://www.enactor.com/retail/storedRestaurantSaleTransaction/service" xmlns:ns22="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns4="https://finanzonline.bmf.gv.at/fon/ws/session" xmlns:ns5="http://www.enactor.com/crm" xmlns:ns6="http://www.enactor.com/addressLookup/service" xmlns:ns9="http://www.enactor.com/retail/restaurantTableStatus/service" xmlns:retail="http://www.enactor.com/retail" xmlns:sref="http://docs.oasis-open.org/wsbpel/2.0/serviceref" xmlns:tools="http://www.enactor.com/tools" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <retail:iccReaderTypeId>{{iccReaderTypeId}}</retail:iccReaderTypeId>
    <retail:deviceId>{{deviceId}}</retail:deviceId>
    <retail:serialNumber>{{serialNumber}}</retail:serialNumber>
    <retail:locationId>{{locationId}}</retail:locationId>
    <retail:dateDefined>{{dateDefined}}</retail:dateDefined>
    <retail:serviceStatus>LIVE</retail:serviceStatus>
    <retail:blocked>false</retail:blocked>
    <retail:keyLoadRequired>false</retail:keyLoadRequired>
    <retail:softwareUpdateRequested>false</retail:softwareUpdateRequested>
</retail:iccReader>
```
