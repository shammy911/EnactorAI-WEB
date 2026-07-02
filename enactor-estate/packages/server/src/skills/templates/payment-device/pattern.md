# Payment Device — XML Template

Use this template to generate the XML for a new Payment device.
Replace all `{{ }}` placeholders with the values collected from the user.

```xml
<retail:paymentDevice xmlns:b4p="http://docs.oasis-open.org/ns/bpel4people/bpel4people/200803" xmlns:bpel11="http://schemas.xmlsoap.org/ws/2003/03/business-process/" xmlns:bpel20="http://docs.oasis-open.org/wsbpel/2.0/process/executable" xmlns:core="http://www.enactor.com/core" xmlns:hta="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/api/200803" xmlns:htd="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/200803" xmlns:htt="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/types/200803" xmlns:ns10="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns17="http://www.enactor.com/crm/customerLoyalty/service" xmlns:ns18="https://finanzonline.bmf.gv.at/fon/ws/session" xmlns:ns19="http://www.enactor.com/retail/storedRestaurantSaleTransaction/service" xmlns:ns20="http://www.enactor.com/addressLookup/service" xmlns:ns21="http://www.enactor.com/retail/restaurantTableStatus/service" xmlns:ns22="http://www.w3.org/2003/05/soap-envelope" xmlns:ns4="http://www.enactor.com/crm" xmlns:ns6="http://www.enactor.com/retail/storedRetailTransaction/service" xmlns:ns7="https://finanzonline.bmf.gv.at/rkdb" xmlns:ns9="http://www.w3.org/2005/08/addressing" xmlns:retail="http://www.enactor.com/retail" xmlns:sref="http://docs.oasis-open.org/wsbpel/2.0/serviceref" xmlns:tools="http://www.enactor.com/tools" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<retail:paymentDeviceID>{{paymentDeviceId}}</retail:paymentDeviceID>
<retail:name>{{paymentDeviceId}}</retail:name>
<retail:locationId>{{locationId}}</retail:locationId>
<retail:serviceType>ICCReaderService</retail:serviceType>
<retail:iccReaderService>
<retail:iccReaderType>{{iccReaderType}}</retail:iccReaderType>
<retail:iccReaderAddress>{{iccReaderAddress}}</retail:iccReaderAddress>
<retail:iccReaderConfigId>{{iccReaderConfigId}}</retail:iccReaderConfigId>
</retail:iccReaderService>
</retail:paymentDevice>

```
