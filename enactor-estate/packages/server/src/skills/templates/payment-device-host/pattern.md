# Payment Device Host — XML Template

Use this template to generate the XML for a new Payment device host.
Replace all `{{ }}` placeholders with the values collected from the user.

```xml
<retail:paymentDeviceHost xmlns:b4p="http://docs.oasis-open.org/ns/bpel4people/bpel4people/200803" xmlns:bpel11="http://schemas.xmlsoap.org/ws/2003/03/business-process/" xmlns:bpel20="http://docs.oasis-open.org/wsbpel/2.0/process/executable" xmlns:core="http://www.enactor.com/core" xmlns:hta="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/api/200803" xmlns:htd="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/200803" xmlns:htt="http://docs.oasis-open.org/ns/bpel4people/ws-humantask/types/200803" xmlns:ns10="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns17="http://www.enactor.com/crm/customerLoyalty/service" xmlns:ns18="https://finanzonline.bmf.gv.at/fon/ws/session" xmlns:ns19="http://www.enactor.com/retail/storedRestaurantSaleTransaction/service" xmlns:ns20="http://www.enactor.com/addressLookup/service" xmlns:ns21="http://www.enactor.com/retail/restaurantTableStatus/service" xmlns:ns22="http://www.w3.org/2003/05/soap-envelope" xmlns:ns4="http://www.enactor.com/crm" xmlns:ns6="http://www.enactor.com/retail/storedRetailTransaction/service" xmlns:ns7="https://finanzonline.bmf.gv.at/rkdb" xmlns:ns9="http://www.w3.org/2005/08/addressing" xmlns:retail="http://www.enactor.com/retail" xmlns:sref="http://docs.oasis-open.org/wsbpel/2.0/serviceref" xmlns:tools="http://www.enactor.com/tools" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<retail:paymentDeviceHostID>{{pdhId}}</retail:paymentDeviceHostID>
<retail:description>{{pdhId}}</retail:description>
<retail:deviceId>{{deviceId}}</retail:deviceId>
<retail:serviceType>ICCReaderService</retail:serviceType>
<retail:proxyAddress>{{proxyAddress}}</retail:proxyAddress>
<retail:tmsPollIntervalSec>60</retail:tmsPollIntervalSec>
<retail:requiresTmsAuthentication>true</retail:requiresTmsAuthentication>
<retail:paymentDeviceId>{{paymentDeviceId}}</retail:paymentDeviceId>
<retail:captureMethod>ESTATE_MANAGER</retail:captureMethod>
<retail:offlineTransactionsRetryIntervalSec>60</retail:offlineTransactionsRetryIntervalSec>
<retail:maximumOfflineTransactions>0</retail:maximumOfflineTransactions>
<retail:maximumOfflineTransactionAmount>0</retail:maximumOfflineTransactionAmount>
<retail:maximumOfflineTransactionsAgeMinutes>0</retail:maximumOfflineTransactionsAgeMinutes>
<retail:tmsCommandPollIntervalSec>60</retail:tmsCommandPollIntervalSec>
<retail:transactionPurgeAgeInDays>90</retail:transactionPurgeAgeInDays>
</retail:paymentDeviceHost>
```
