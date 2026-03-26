#include <boost/algorithm/string.hpp>
#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>
#include <roofcore/utils/Configuration.h>
#include <roofcore/utils/program_name.h>
#include <roofcore/utils/ReadConfiguration.h>
#include <roofipc/MessageSubscriber.h>
#include <roofipc/TransportProtocolParser.h>
#include <roofifmsg/IFData_t.h>
#include <roofifmsg/EmissionProfile_t.h>

#define DEF_CONFIG_FILE_PATH  "./config/setup.config"


//-------------------------------------------------------------------------------------------------
// namespace aliases.

namespace BFS = boost::filesystem;
namespace BPO = boost::program_options;
namespace BS  = boost::system;
namespace RCU = ROOF::core::utils;
namespace RI  = ROOF::ipc;
namespace RIF = ROOF::ifmsg;


//-------------------------------------------------------------------------------------------------
// Local functions.

static unsigned int
lexicalCast_StringToUInt(const std::string& strItem, unsigned int uiDefaultValue)
{
    try
    {
        return boost::lexical_cast<unsigned int>(strItem);
    }
    catch (const boost::bad_lexical_cast &)
    {
        return uiDefaultValue;
    }
}

static void
messageReceived(const std::string& strMsgString)
{
    // NOTA: L'header del messaggio viene parsato direttamente nel costruttore del "TransportProtocolParser". Perciò come faccio a sapere se l'operazione è andata a buon fine?
    // Lo posso dedurre dal valore restituito da "messageid()": se è 0 vuol dire che l'operazione è fallita.
    RI::TransportProtocolParser xTPParser(strMsgString.c_str(), strMsgString.size());

    unsigned int     uiDestinationId    = xTPParser.destinationId();
    RI::DomainID     eDomainId          = xTPParser.domainId();
    unsigned int     uiMessageId        = xTPParser.messageid();
    RI::EncodingType eEncodingType      = xTPParser.encoding();
    bool             bCompression       = xTPParser.compression();
    unsigned short   uiByteOrderPattern = xTPParser.byteOrderPattern();
    std::string      strMessageBytes    = std::string(xTPParser.messageBytes(), xTPParser.messageBytesLength());

    ADD_LOG_DEBUG << "NEW-MESSAGE:" << std::endl
                  << "  MsgString.length    : " << strMsgString.length() << std::endl
                  << "  DestinationId       : " << uiDestinationId << std::endl
                  << "  DomainId            : " << eDomainId << " (" << RI::DomainIdToString(eDomainId) << ")" << std::endl
                  << "  MessageId           : " << uiMessageId << std::endl
                  << "  EncodingType        : " << eEncodingType << " (" << RI::EncodingTypeToString(eEncodingType) << ")" << std::endl
                  << "  Compression         : " << (bCompression ? "TRUE" : "FALSE") << std::endl
                  << "  ByteOrderPattern    : " << std::hex << std::showbase << uiByteOrderPattern << std::dec << std::endl
                  << "  MessageBytes.length : " << strMessageBytes.length() << std::endl;

    if (eDomainId == RI::Stream)
    {
        if (uiMessageId == RIF::ROOF_IF_MSG)
        {
            ADD_LOG_DEBUG << "Message is 'ROOF_IF_MSG'";
            if (eEncodingType == RI::BINARY)
            {
                RIF::ROOFIFMsg_t xROOFIFMsg;
                int iReadIndex = 0;
                xROOFIFMsg.FromByteEncoding(strMessageBytes, iReadIndex);

                // NOTA: Un messaggio di tipo 'ROOFIFMsg_t' è un vector e può contenere al più una PSD, una CBB, una FFT e un EmissionProfileList.
                RIF::F32IFData_t*           pxPSD = nullptr;
                RIF::CI16IFData_t*          pxCBB = nullptr;
                RIF::CF32IFData_t*          pxFFT = nullptr;
                RIF::EmissionProfileList_t* pxEPList = nullptr;

                ADD_LOG_DEBUG << "ROOFIFMsg.size=" << xROOFIFMsg.size();
                for (std::size_t i = 0; i < xROOFIFMsg.size(); ++i)
                {
                    const std::string& strMsgString_2 = xROOFIFMsg[i].m_strValue;
                    if (strMsgString_2.size() > 0)
                    {
                        RI::TransportProtocolParser xTPParser_2(strMsgString_2.c_str(), strMsgString_2.size());

                        unsigned int uiMessageId_2     = xTPParser_2.messageid();
                        std::string  strMessageBytes_2 = std::string(xTPParser_2.messageBytes(), xTPParser_2.messageBytesLength());
                        ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "]: - Length=" << strMessageBytes_2.length() << " - ID=" << uiMessageId_2;

                        if (uiMessageId_2 == RIF::I8_IFDATA_MSG)
                        {
                            //PSD-I8
                            RIF::I8IFData_t xI8IFData;
                            int iReadIndex_2 = 0;
                            xI8IFData.FromByteEncoding(strMessageBytes_2, iReadIndex_2);
                            ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "] is 'I8_IFDATA_MSG' -> TuningStepIndex=" << xI8IFData.uiTuningStepIndex;

                            // Qui NON è necessario allocare memoria per "pxPSD" (l'allocazione viene fatta direttamente dalla funzione qui sotto).
                            RIF::convertIFDataFromI8ToF32(&xI8IFData, pxPSD);
                        }
                        else if (uiMessageId_2 == RIF::I16_IFDATA_MSG)
                        {
                            //PSD-I16
                            RIF::I16IFData_t xI16IFData;
                            int iReadIndex_2 = 0;
                            xI16IFData.FromByteEncoding(strMessageBytes_2, iReadIndex_2);
                            ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "] is 'I16_IFDATA_MSG' -> TuningStepIndex=" << xI16IFData.uiTuningStepIndex;

                            // Qui NON è necessario allocare memoria per "pxPSD" (l'allocazione viene fatta direttamente dalla funzione qui sotto).
                            RIF::convertIFDataFromI16ToF32(&xI16IFData, pxPSD);
                        }
                        else if (uiMessageId_2 == RIF::F32_IFDATA_MSG)
                        {
                            //PSD-F32
                            int iReadIndex_2 = 0;
                            pxPSD = new RIF::F32IFData_t;
                            pxPSD->FromByteEncoding(strMessageBytes_2, iReadIndex_2);
                            ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "] is 'F32_IFDATA_MSG' -> TuningStepIndex=" << pxPSD->uiTuningStepIndex;
                        }
                        else if (uiMessageId_2 == RIF::CI16_IFDATA_MSG)
                        {
                            //CBB16
                            int iReadIndex_2 = 0;
                            pxCBB = new RIF::CI16IFData_t;
                            pxCBB->FromByteEncoding(strMessageBytes_2, iReadIndex_2);
                            ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "] is 'CI16_IFDATA_MSG' -> TuningStepIndex=" << pxCBB->uiTuningStepIndex;
                        }
                        else if (uiMessageId_2 == RIF::CF32_IFDATA_MSG)
                        {
                            //CFFT32
                            int iReadIndex_2 = 0;
                            pxFFT = new RIF::CF32IFData_t;
                            pxFFT->FromByteEncoding(strMessageBytes_2, iReadIndex_2);
                            ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "] is 'CF32_IFDATA_MSG' -> TuningStepIndex=" << pxFFT->uiTuningStepIndex;
                        }
                        else if (uiMessageId_2 == RIF::EMISSION_PROFILE_LIST_MSG)
                        {
                            //EmissionProfileList
                            int iReadIndex_2 = 0;
                            pxEPList = new RIF::EmissionProfileList_t;
                            pxEPList->FromByteEncoding(strMessageBytes_2, iReadIndex_2);
                            ADD_LOG_DEBUG << "ROOFIFMsg[" << i << "] is 'EMISSION_PROFILE_LIST_MSG' -> Length=" << pxEPList->length();
                            for(uint32_t j=0; j<pxEPList->length(); j++)
                            {
                                ADD_LOG_DEBUG << "EMISSION_PROFILE [" << j << "] -> Parent Length=" << pxEPList->xEmissionList.at(j).xParentEmissions.size();
                            }
                        }
                    }
                }

                // NOTA: In questo esempio gli oggetti allocati qua sopra non vengono usati. Perciò sono subito distrutti.
                // In un caso reale i puntatori verranno passati ad altre funzioni/oggetti (saranno poi loro ad avere la responsabilità di deallocare la memoria).
                //
                if (pxPSD != nullptr)
                {
                    delete pxPSD;
                }

                if (pxCBB != nullptr)
                {
                    delete pxCBB;
                }

                if (pxFFT != nullptr)
                {
                    delete pxFFT;
                }

                if (pxEPList != nullptr)
                {
                    delete pxEPList;
                }
            }
        }
        else if ( uiMessageId == ROOF::ifmsg::CI16_IFDATA_MSG )
        {
            //CBB16
            int iReadIndex = 0;
            RIF::CI16IFData_t* pxdata = new RIF::CI16IFData_t;
            pxdata->FromByteEncoding(strMessageBytes, iReadIndex);
            ADD_LOG_DEBUG << "CI16_IFDATA_MSG -> TuningStepIndex= " << pxdata->uiTuningStepIndex<<"\t"<<"length= "<<pxdata->length();
            delete pxdata;
        }
        else if ( uiMessageId == ROOF::ifmsg::CF32_IFDATA_MSG )
        {
            //CFFT32
            int iReadIndex = 0;
            RIF::CF32IFData_t* pxdata = new RIF::CF32IFData_t;
            pxdata->FromByteEncoding(strMessageBytes, iReadIndex);
            ADD_LOG_DEBUG << "CF32_IFDATA_MSG -> TuningStepIndex= " << pxdata->uiTuningStepIndex<<"\t"<<"length= "<<pxdata->length();
            delete pxdata;
        }
    }
}


//-------------------------------------------------------------------------------------------------
// Main function.

int
main(int argc, char** argv)
{
    //--------------------------------------------------------------------------
    // 1 - Leggo dalla command-line il path del file di configurazione.
    //

    std::string strConfigFilePath = DEF_CONFIG_FILE_PATH;

    try
    {
        // Leggo i parametri di input.
        BPO::options_description xDesc("Allowed options");
        xDesc.add_options()
                ("help", "produce help message")
                ("config-file", BPO::value<std::string>()->default_value(DEF_CONFIG_FILE_PATH), "set the path for the configuration file used by the application.");

        BPO::parsed_options xParsedOptions = BPO::command_line_parser(argc, argv).options(xDesc).allow_unregistered().run();
        BPO::variables_map xVarsMap;

        BPO::store(xParsedOptions, xVarsMap);
        BPO::notify(xVarsMap);

        if (xVarsMap.count("help") > 0)
        {
            std::cout << xDesc << std::endl;
            exit(0);
        }

        strConfigFilePath = (xVarsMap.count("config-file") > 0) ? boost::trim_copy(xVarsMap["config-file"].as<std::string>()) : strConfigFilePath;
    }
    catch (const std::exception& xException)
    {
        std::cout << "EXCEPTION CATCHED : " << xException.what() << std::endl
                  << "USING DEFAULT OPTION-VALUES" << std::endl
                  << std::endl;
    }

    BFS::path      xPath(strConfigFilePath);
    BS::error_code xErrorCode;

    std::string strConfigFilePath2 = BFS::canonical(xPath, xErrorCode).string();

    // In caso di errore della funzione "BFS::canonical" stampo il path originale.
    std::cout << "----- INPUT-PARAMS - BEGIN" << std::endl
              << "  ConfigFilePath : '" << (xErrorCode ? strConfigFilePath : strConfigFilePath2) << "'" << std::endl
              << "----- INPUT-PARAMS - END" << std::endl;

    //--------------------------------------------------------------------------
    // 2 - Faccio il setup del logger.
    //

    // Per prima cosa imposto dentro "ProgramName" il nome ed il path dell'eseguibile.
    // NOTA: Senza queste istruzioni il logger NON riesce a scrivere su file.
    RCU::ProgramName::setName(argv[0], true);
    RCU::ProgramName::setPath();

    // Poi imposto il logger.
    LOGGER->setupFromFile(strConfigFilePath);

    //--------------------------------------------------------------------------
    // 3 - Leggo dal file di configurazione i parametri per il subscriber.
    //

    std::string strRemoteAddressList = "";
    std::string strFilterList = "";

    RCU::Configuration xConfiguration(strConfigFilePath.c_str());
    if (!xConfiguration.acquire())
    {
        std::cout << "ERROR - UNABLE TO READ CONFIGURATION FILE '" << strConfigFilePath << "'" << std::endl
                  << "BYE" << std::endl
                  << std::endl;

        exit(1);
    }

    RCU::readConfValue(xConfiguration, "SUBSCRIBER", "REMOTE_ADDRESS_LIST", strRemoteAddressList, std::string(""));
    RCU::readConfValue(xConfiguration, "SUBSCRIBER", "FILTER_LIST", strFilterList, std::string(""));

    boost::trim(strRemoteAddressList);
    boost::trim(strFilterList);

    std::cout << "----- SUBSCRIBER - BEGIN" << std::endl
              << "  RemoteAddressList : '" << strRemoteAddressList << "'" << std::endl
              << "  FilterList        : '" << strFilterList << "'" << std::endl
              << "----- SUBSCRIBER - END" << std::endl
              << std::endl;

    //--------------------------------------------------------------------------
    // 4 - Faccio il parsing dei dati letti dal file di configurazione.
    //

    // 4.1 - Estraggo la lista dei remote-address.
    std::vector<std::string> xRemoteAddressList;
    if (strRemoteAddressList.length() > 0)
    {
        boost::split(xRemoteAddressList, strRemoteAddressList, boost::is_any_of("&"));
    }


    // 4.2 - Estraggo la lista dei filtri (cioè la lista dei message-id che verranno accettati in ingresso).
    // Se la lista è vuota verranno accettati tutti i messaggi.
    std::vector<unsigned int> xMessageIdList;

    std::vector<std::string> xTempList;
    if (strFilterList.length() > 0)
    {
        boost::split(xTempList, strFilterList, boost::is_any_of(";"));
    }

    for (auto strItem : xTempList)
    {
        boost::trim(strItem);
        if (strItem.length() > 0)
        {
            unsigned int uiMessageId = lexicalCast_StringToUInt(strItem, NOMESSAGEID);
            xMessageIdList.push_back(uiMessageId);
        }
    }

    //--------------------------------------------------------------------------
    // 5 - Creazione/Configurazione/Start del subscriber.
    //

    // 5.1 - Creo il subscriber.
    RI::MessageSubscriber* pxMessageSubscriber = new RI::MessageSubscriber;

    // 5.2 - Configuro il subscriber.
    //

    // 5.2.1 - Qui imposto la lista degli indirizzi da sottoscrivere e la lista dei filtri da applicare sui messaggi in ricezione.
    pxMessageSubscriber->setAddressList(xRemoteAddressList);
    pxMessageSubscriber->setFilterList(xMessageIdList);

    // 5.2.2 - Qui indico qual è la funzione da chiamare ogni volta che il subscriber riceve un messaggio.
    pxMessageSubscriber->connectToMessageReceivedSignal([](const std::string & strMsgString)
    {
        // IMPORTANTE: Qui dentro ci troviamo in un thread secondario.
        ADD_LOG_DEBUG << "******************************** MessageReceived **********" << std::endl
                      << "RECEIVE-THREAD: ID=" << std::hex << std::showbase << std::this_thread::get_id();

        messageReceived(strMsgString);
    });

    // 5.3 - Avvio il subscriber.
    if (!pxMessageSubscriber->start())
    {
        std::cout << "UNABLE TO START MESSAGE-SUBSCRIBER" << std::endl;
        delete pxMessageSubscriber;
        exit(1);
    }

    // NOTA: I punti dello step 5 di questo test sono eseguiti nel "main" ma in un caso reale verranno eseguiti in una classe.
    // Ad esempio, la funzione "messageReceived" che in questo test è una funzione statica nel caso reale probabilmente sarà una funzione membro di classe.

    //--------------------------------------------------------------------------
    // 6 - Mi metto in attesa dei messaggi
    //

    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    ADD_LOG_DEBUG << "MAIN-THREAD: ID=" << std::hex << std::showbase << std::this_thread::get_id() << std::dec;

    std::cout << std::endl
              << "----- MENU" << std::endl
              << "  QUIT: exit from the program" << std::endl
              << std::endl;

    // Questo loop mi serve (solo per questo test) per bloccare il main-thread (finché l'utente non decide di uscire digitando "QUIT").
    while (true)
    {
        std::string strText;
        std::getline(std::cin, strText);

        boost::trim(strText);
        if (strText.length() == 0)
        {
            continue;
        }

        if (boost::iequals(strText, "QUIT"))
        {
            pxMessageSubscriber->stop();
            break;
        }
    }

    delete pxMessageSubscriber;
    return 0;
}
