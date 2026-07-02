# Device — XML Template

Use this template to generate the XML for a new device.
Replace all `{{ }}` placeholders with the values collected from the user.

```xml
<retail:device xmlns:core="http://www.enactor.com/core" xmlns:hta="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/api/200803" xmlns:htd="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/200803" xmlns:htt="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/types/200803" xmlns:ns10="http://www.enactor.com/addressLookup/service" xmlns:ns11="http://www.enactor.com/retail/restaurantTableStatus/service" xmlns:ns12="https://finanzonline.bmf.gv.at/fon/ws/session" xmlns:ns13="http://www.enactor.com/retail/storedRestaurantSaleTransaction/service" xmlns:ns14="http://www.enactor.com/crm/customerLoyalty/service" xmlns:ns15="http://www.enactor.com/retail/storedRetailTransaction/service" xmlns:ns4="http://www.enactor.com/crm" xmlns:ns5="https://finanzonline.bmf.gv.at/rkdb" xmlns:retail="http://www.enactor.com/retail" xmlns:sref="http://docs.oasis-open.org/wsbpel/2.0/serviceref" xmlns:tools="http://www.enactor.com/tools" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <retail:deviceId>{{deviceId}}</retail:deviceId>
    <retail:deviceName>{{deviceName}}</retail:deviceName>
    <retail:deviceNotInUse>false</retail:deviceNotInUse>
    <retail:deviceType>{{deviceType}}</retail:deviceType>
    <retail:hostName>{{hostName}}</retail:hostName>
    <retail:locationId>{{locationId}}</retail:locationId>
    <retail:notes></retail:notes>
    <retail:dataSource/>
    <retail:httpPort>8080</retail:httpPort>
    <retail:rmiPort>2099</retail:rmiPort>
</retail:device>
```
